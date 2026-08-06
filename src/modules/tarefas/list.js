import { el, mount } from '../../shared/utils/dom.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { createSortableHead } from '../../shared/components/SortableHead.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { shortDateTime } from '../../shared/utils/formatters.js'
import {
  RESPONSAVEIS, nomesResponsaveis,
  createTarefa, updateTarefa, deleteTarefa, marcarStatus,
} from './service.js'

const PRIORIDADES = [
  { key: 'baixa', label: 'Baixa' },
  { key: 'media', label: 'Média' },
  { key: 'alta',  label: 'Alta' },
]
const STATUS_META = {
  pendente:     { label: 'Pendente',     cls: 'badge-pendente' },
  em_andamento: { label: 'Em andamento', cls: 'badge-em-andamento' },
  concluida:    { label: 'Concluída',    cls: 'badge-concluido' },
}
const STATUS_ORDER = ['pendente', 'em_andamento', 'concluida']
const PRIORIDADE_META = {
  baixa: { label: 'Baixa', cls: 'badge-prioridade-baixa' },
  media: { label: 'Média', cls: 'badge-prioridade-media' },
  alta:  { label: 'Alta',  cls: 'badge-prioridade-alta' },
}
// Sentinela alta o bastante pra empurrar tarefa sem prazo pro fim da lista
// quando ordenado por prazo, sem precisar tratar null/undefined à parte.
const SEM_PRAZO = '9999-12-31T23:59'

function nowLocalDT() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function isAtrasada(t) {
  return !!t.prazo && t.status !== 'concluida' && t.prazo < nowLocalDT()
}

function abrirFormModal(tarefa) {
  const isEdit = !!tarefa

  openModal({
    title: isEdit ? 'Editar tarefa' : 'Nova tarefa',
    size: 'md',
    renderBody: (body) => {
      const tituloInp = el('input', { type: 'text', class: 'field-input', placeholder: 'Ex: Ligar pro fornecedor X' })
      tituloInp.value = tarefa?.titulo || ''

      const descInp = el('textarea', { rows: '3', class: 'field-textarea' })
      descInp.value = tarefa?.descricao || ''

      const respState = new Set(tarefa?.responsaveis || [])
      const respBtns = RESPONSAVEIS.map(r => {
        const btn = el('button', { type: 'button', class: 'status-chip-btn' }, r.nome)
        if (respState.has(r.uid)) btn.classList.add('active')
        btn.addEventListener('click', () => {
          if (respState.has(r.uid)) respState.delete(r.uid)
          else respState.add(r.uid)
          btn.classList.toggle('active', respState.has(r.uid))
        })
        return btn
      })
      const respRow = el('div', { class: 'status-chips-row' }, ...respBtns)

      let prioridade = tarefa?.prioridade || 'media'
      const prioBtns = PRIORIDADES.map(p => {
        const btn = el('button', { type: 'button', class: 'status-chip-btn' }, p.label)
        if (p.key === prioridade) btn.classList.add('active')
        btn.addEventListener('click', () => {
          prioridade = p.key
          prioBtns.forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
        })
        return btn
      })
      const prioRow = el('div', { class: 'status-chips-row' }, ...prioBtns)

      const prazoInp = el('input', { type: 'datetime-local', class: 'field-input' })
      prazoInp.value = tarefa?.prazo || ''

      mount(body,
        el('div', { class: 'field' }, el('label', {}, 'Título'), tituloInp),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Descrição'), descInp),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Responsável'), respRow),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Prioridade'), prioRow),
        el('div', { class: 'field', style: 'margin-top:14px' },
          el('label', {}, 'Prazo (dispara lembrete no WhatsApp nesse horário)'), prazoInp),
      )

      body._getPayload = () => ({
        titulo: tituloInp.value.trim(),
        descricao: descInp.value.trim(),
        responsaveis: [...respState],
        prioridade,
        prazo: prazoInp.value,
      })
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, isEdit ? 'Salvar' : 'Criar tarefa')

      cancelBtn.addEventListener('click', close)
      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const payload = body?._getPayload?.()
        if (!payload) return

        if (!payload.titulo) return toastError('Informe o título da tarefa.')
        if (!payload.responsaveis.length) return toastError('Marque ao menos um responsável.')

        saveBtn.disabled = true
        saveBtn.textContent = 'Salvando...'
        try {
          if (isEdit) {
            await updateTarefa(tarefa.id, payload)
            toastSuccess('Tarefa atualizada.')
          } else {
            await createTarefa(payload)
            toastSuccess('Tarefa criada.')
          }
          close()
        } catch (err) {
          console.error(err)
          toastError('Erro ao salvar tarefa.')
          saveBtn.disabled = false
          saveBtn.textContent = isEdit ? 'Salvar' : 'Criar tarefa'
        }
      })

      footerEl.append(cancelBtn, saveBtn)
    },
  })
}

function proximoStatus(atual) {
  const i = STATUS_ORDER.indexOf(atual)
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length]
}

export function renderTarefasList(container, tarefas) {
  let filtroResp = 'todos' // 'todos' | uid
  let mostrarConcluidas = false

  const filtroBtns = [{ uid: 'todos', nome: 'Todos' }, ...RESPONSAVEIS].map(r => {
    const btn = el('button', { type: 'button', class: 'config-tab-btn' }, r.nome)
    btn.addEventListener('click', () => { filtroResp = r.uid; updateFiltroBtns(); refresh() })
    return btn
  })
  function updateFiltroBtns() {
    filtroBtns.forEach((btn, i) => {
      const uid = i === 0 ? 'todos' : RESPONSAVEIS[i - 1].uid
      btn.classList.toggle('active', uid === filtroResp)
    })
  }
  updateFiltroBtns()
  const filtroBar = el('div', { class: 'config-tab-bar' }, ...filtroBtns)

  const concluidasCheck = el('input', { type: 'checkbox' })
  concluidasCheck.addEventListener('change', () => { mostrarConcluidas = concluidasCheck.checked; refresh() })
  const concluidasLabel = el('label', { class: 'perm-label' }, concluidasCheck, 'Mostrar concluídas')

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Nova Tarefa')
  newBtn.addEventListener('click', () => abrirFormModal())

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:16px;align-items:center' }, newBtn, concluidasLabel),
    countBadge,
  )

  const sortHead = createSortableHead([
    { key: 'prioridade', label: 'Prioridade' },
    { key: 'titulo',     label: 'Título' },
    { key: 'resp',       label: 'Responsável' },
    { key: 'prazo',      label: 'Prazo' },
    { key: 'status',     label: 'Status' },
    { key: null,         label: '', cls: 'col-actions' },
  ], {
    initialCol: 'prazo',
    initialDir: 'asc',
    sortValue: (t, key) => {
      switch (key) {
        case 'prioridade': return { baixa: 0, media: 1, alta: 2 }[t.prioridade] ?? 1
        case 'titulo':     return t.titulo || ''
        case 'resp':       return nomesResponsaveis(t.responsaveis)
        case 'prazo':      return t.prazo || SEM_PRAZO
        case 'status':     return STATUS_ORDER.indexOf(t.status)
        default:           return ''
      }
    },
    onSort: () => refresh(),
  })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' }, el('thead', {}, el('tr', {}, ...sortHead.ths)), tbody)
  const tableWrap = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('p', { class: 'text-muted' }, 'Nenhuma tarefa por aqui.')
  emptyState.style.display = 'none'

  function refresh() {
    let filtered = tarefas.filter(t => mostrarConcluidas || t.status !== 'concluida')
    if (filtroResp !== 'todos') filtered = filtered.filter(t => (t.responsaveis || []).includes(filtroResp))

    countBadge.textContent = `${filtered.length} tarefa${filtered.length === 1 ? '' : 's'}`

    const sorted = sortHead.sort(filtered)
    emptyState.style.display = sorted.length ? 'none' : ''
    tableWrap.style.display = sorted.length ? '' : 'none'

    const rows = sorted.map(t => {
      const prioMeta = PRIORIDADE_META[t.prioridade] || PRIORIDADE_META.media
      const statusMeta = STATUS_META[t.status] || STATUS_META.pendente

      const statusBtn = el('button', { type: 'button', class: `badge ${statusMeta.cls}`, style: 'border:none;cursor:pointer;font-family:inherit' }, statusMeta.label)
      statusBtn.title = 'Clique para avançar o status'
      statusBtn.addEventListener('click', async () => {
        try {
          await marcarStatus(t.id, proximoStatus(t.status))
        } catch (err) {
          console.error(err)
          toastError('Erro ao atualizar status.')
        }
      })

      const atrasada = isAtrasada(t)
      const prazoCell = el('td', {
        class: atrasada ? 'tarefa-prazo-atrasado' : '',
        title: atrasada ? 'Prazo vencido' : '',
      }, shortDateTime(t.prazo))

      const actions = renderRowActions({
        canEdit: true,
        canDelete: true,
        onEdit: () => abrirFormModal(t),
        onDelete: () => {
          openConfirm({
            title: 'Excluir tarefa?',
            message: `"${t.titulo}" será removida permanentemente.`,
            confirmLabel: 'Excluir',
            danger: true,
            onConfirm: async () => {
              try {
                await deleteTarefa(t.id)
                toastSuccess('Tarefa excluída.')
              } catch (err) {
                console.error(err)
                toastError('Erro ao excluir.')
              }
            },
          })
        },
      })

      return el('tr', {},
        el('td', {}, el('span', { class: `badge ${prioMeta.cls}` }, prioMeta.label)),
        el('td', { class: 'td-name', title: t.titulo || '' }, t.titulo || '—'),
        el('td', {}, nomesResponsaveis(t.responsaveis)),
        prazoCell,
        el('td', {}, statusBtn),
        el('td', { class: 'col-actions' }, actions),
      )
    })

    tbody.replaceChildren(...rows)
  }

  mount(container,
    el('div', { class: 'page-header' }, el('h2', {}, 'Tarefas')),
    filtroBar,
    toolbar,
    tableWrap,
    emptyState,
  )
  refresh()

  return {
    update(newTarefas) { tarefas = newTarefas; refresh() },
  }
}
