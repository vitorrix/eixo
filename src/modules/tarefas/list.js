import { el, mount } from '../../shared/utils/dom.js'
import { openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { createSortableHead } from '../../shared/components/SortableHead.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { shortDateTime } from '../../shared/utils/formatters.js'
import { RESPONSAVEIS, nomesResponsaveis, deleteTarefa, marcarStatus } from './service.js'
import { abrirTarefaFormModal } from './form.js'
import { toolbarCard, toolbarMeta } from '../../shared/components/ToolbarCard.js'
import { STATUS_META, STATUS_ORDER, PRIORIDADE_META, SEM_PRAZO, isAtrasada, proximoStatus } from './constants.js'

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
  newBtn.addEventListener('click', () => abrirTarefaFormModal())

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = toolbarCard(newBtn, concluidasLabel, toolbarMeta(countBadge))

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
        onEdit: () => abrirTarefaFormModal(t),
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
