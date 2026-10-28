import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toolbarCard, searchWithIcon } from '../../shared/components/ToolbarCard.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { tornarLinhaClicavel } from '../../shared/components/DetalhesModal.js'
import { whatsappLink, whatsappIcon } from '../../shared/utils/whatsapp.js'
import { NOMES_MODELOS, coresOficiais, normalizarTexto } from '../../shared/utils/dicionarioCores.js'
import { CAPACIDADES, compararDesejo, rotuloUnidade, rotuloDesejo, mensagemAviso } from '../../shared/utils/desejos.js'
import { createDesejo, updateDesejo, mudarStatusDesejo, registrarAviso, deleteDesejo } from './service.js'

const dataBR = ts => ts?.toDate ? ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'

export function renderDesejos(container, desejos, unidades, estoqueIndisponivel) {
  const canCreate = can('clientes', 'create')
  const canEdit = can('clientes', 'edit')
  const canDelete = can('clientes', 'delete')
  let todos = desejos, estoque = unidades, semEstoque = estoqueIndisponivel
  let clientesCache = null

  const buscaInp = el('input', { type: 'search', class: 'field-input', placeholder: 'Buscar cliente ou aparelho...' })
  const filtroSel = el('select', { class: 'field-select' },
    el('option', { value: 'abertos' }, 'Em aberto'),
    el('option', { value: 'estoque' }, 'Com algo no estoque'),
    el('option', { value: 'atendidos' }, 'Atendidos'),
    el('option', { value: 'cancelados' }, 'Cancelados'),
    el('option', { value: 'todos' }, 'Todos'),
  )
  buscaInp.addEventListener('input', renderRows)
  filtroSel.addEventListener('change', renderRows)

  const tbody = document.createElement('tbody')
  const tableWrap = el('div', { class: 'table-wrapper' }, el('table', { class: 'data-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Cliente'), el('th', {}, 'Aparelho desejado'), el('th', {}, 'Capacidade'), el('th', {}, 'Cor'),
      el('th', {}, 'Estoque'), el('th', {}, 'Anotado'), el('th', {}, 'Avisado'),
    )),
    tbody,
  ))
  const vazio = el('div', { class: 'empty-state' })
  const avisoEstoque = el('p', { class: 'text-muted', style: 'margin:0 0 10px' },
    'Sem permissão para ver as Compras: a comparação com o estoque está indisponível.')

  const comparar = d => compararDesejo(d, estoque)
  const situacao = d => (d.status && d.status !== 'aberto') ? null : comparar(d)

  function badgeEstoque(d) {
    const r = situacao(d)
    if (!r) return el('span', { class: 'text-muted' }, d.status === 'atendido' ? 'Atendido' : 'Cancelado')
    if (r.identicos.length) return el('span', { class: 'status-badge badge-pago' }, `✅ Idêntico (${r.identicos.length})`)
    if (r.semelhantes.length) return el('span', { class: 'status-badge badge-negociando' }, `🟡 Semelhante (${r.semelhantes.length})`)
    return el('span', { class: 'text-muted' }, '—')
  }

  // Quem tem algo no estoque vem primeiro; depois os mais antigos (esperando há mais tempo).
  const peso = d => { const r = situacao(d); return !r ? 3 : r.identicos.length ? 0 : r.semelhantes.length ? 1 : 2 }

  function renderRows() {
    const q = normalizarTexto(buscaInp.value)
    const f = filtroSel.value
    const lista = todos
      .filter(d => {
        const st = d.status || 'aberto'
        if (f === 'abertos') return st === 'aberto'
        if (f === 'estoque') { const r = situacao(d); return !!r && (r.identicos.length || r.semelhantes.length) }
        if (f === 'atendidos') return st === 'atendido'
        if (f === 'cancelados') return st === 'cancelado'
        return true
      })
      .filter(d => !q || normalizarTexto(`${d.cliente} ${rotuloDesejo(d)}`).includes(q))
      .sort((a, b) => peso(a) - peso(b) || (a.criadoEm?.toMillis?.() || 0) - (b.criadoEm?.toMillis?.() || 0))

    tableWrap.style.display = lista.length ? '' : 'none'
    vazio.style.display = lista.length ? 'none' : ''
    vazio.replaceChildren(el('p', {}, todos.length
      ? 'Nenhum desejo neste filtro.'
      : 'Nenhum desejo cadastrado. Quando um cliente pedir pra avisar de um aparelho, clique em "+ Novo desejo".'))
    avisoEstoque.style.display = semEstoque ? '' : 'none'
    tbody.replaceChildren(...lista.map(d => {
      const row = el('tr', {},
        el('td', {}, d.cliente || '—'),
        el('td', {}, d.modelo),
        el('td', {}, d.capacidade || 'Qualquer'),
        el('td', {}, d.cor || 'Qualquer'),
        el('td', {}, badgeEstoque(d)),
        el('td', { class: 'td-date' }, dataBR(d.criadoEm)),
        el('td', { class: 'td-date' }, d.avisadoEm ? dataBR(d.avisadoEm) : '—'),
      )
      tornarLinhaClicavel(row, () => abrirDetalhes(d))
      return row
    }))
  }

  // ── Detalhes ────────────────────────────────────────────────────────────────
  function abrirDetalhes(d) {
    openModal({
      title: `Desejo — ${d.cliente || 'sem nome'}`,
      size: 'lg',
      renderBody: (body, close) => {
        const r = comparar(d)
        const linha = (l, v) => el('div', { class: 'detalhes-linha' },
          el('span', { class: 'detalhes-label' }, l), el('span', { class: 'detalhes-valor' }, v))
        const unidadeEl = (u, rot) => linha(rot, `${rotuloUnidade(u)} — ${u.fornecedor || 'sem fornecedor'}`)
        const aberto = (d.status || 'aberto') === 'aberto'

        const botoes = []
        const fechar = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fechar.addEventListener('click', close)
        botoes.push(fechar)

        if (canDelete) {
          const del = el('button', { type: 'button', class: 'btn btn-danger-outline' }, 'Excluir')
          del.addEventListener('click', () => {
            close()
            openConfirm({
              title: 'Excluir desejo', message: 'Remove este desejo da lista. Não pode ser desfeito.',
              confirmLabel: 'Excluir', danger: true,
              onConfirm: async () => {
                try { await deleteDesejo(d.id); toastSuccess('Desejo excluído.') } catch { toastError('Erro ao excluir.') }
              },
            })
          })
          botoes.unshift(del)
        }
        if (canEdit) {
          const edit = el('button', { type: 'button', class: 'btn btn-outline' }, '✏️ Editar')
          edit.addEventListener('click', () => { close(); abrirForm(d) })
          botoes.push(edit)
          const muda = (st, rotulo, msg) => {
            const b = el('button', { type: 'button', class: 'btn btn-outline' }, rotulo)
            b.addEventListener('click', async () => {
              try { await mudarStatusDesejo(d.id, st); toastSuccess(msg); close() } catch { toastError('Erro ao atualizar.') }
            })
            return b
          }
          if (aberto) { botoes.push(muda('cancelado', 'Cancelar desejo', 'Desejo cancelado.'), muda('atendido', '✔ Atendido', 'Desejo marcado como atendido.')) }
          else botoes.push(muda('aberto', 'Reabrir', 'Desejo reaberto.'))
        }
        const wa = (aberto && (r.identicos.length || r.semelhantes.length))
          ? whatsappLink(d.telefone, '55', mensagemAviso(d, r)) : null
        if (wa) {
          const b = el('a', { class: 'btn btn-primary', href: wa, target: '_blank', rel: 'noopener' }, whatsappIcon(), ' Avisar no WhatsApp')
          b.addEventListener('click', () => { if (canEdit) registrarAviso(d.id).catch(err => console.error(err)) })
          botoes.push(b)
        } else if (aberto && (r.identicos.length || r.semelhantes.length)) {
          botoes.push(el('span', { class: 'text-muted', style: 'font-size:13px;align-self:center' }, 'Sem telefone cadastrado — edite o desejo para avisar.'))
        }

        mount(body,
          el('div', { class: 'detalhes-grid' },
            linha('Cliente', d.cliente || '—'),
            linha('Telefone', d.telefone || '—'),
            linha('Aparelho', rotuloDesejo(d)),
            d.observacoes ? linha('Observações', d.observacoes) : null,
            linha('Anotado em', dataBR(d.criadoEm)),
            d.avisadoEm ? linha('Último aviso', dataBR(d.avisadoEm)) : null,
            ...(!aberto ? [linha('Situação', d.status === 'atendido' ? 'Atendido' : 'Cancelado')] : []),
            ...(aberto && semEstoque ? [linha('Estoque', 'Comparação indisponível (sem permissão para ver Compras).')] : []),
            ...(aberto && !semEstoque && !r.identicos.length && !r.semelhantes.length ? [linha('Estoque', 'Nada igual ou parecido no estoque agora.')] : []),
            ...(aberto ? r.identicos.map(u => unidadeEl(u, '✅ Idêntico')) : []),
            ...(aberto ? r.semelhantes.map(u => unidadeEl(u, '🟡 Semelhante')) : []),
          ),
          el('div', { class: 'modal-footer' }, ...botoes),
        )
      },
    })
  }

  // ── Novo / editar ───────────────────────────────────────────────────────────
  async function carregarClientes() {
    if (clientesCache) return clientesCache
    const snap = await getDocs(query(collection(db, 'clientes'), orderBy('nameLower')))
    clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return clientesCache
  }

  async function abrirForm(d = null) {
    let clientes = []
    try { clientes = await carregarClientes() } catch (err) { console.error('Clientes indisponíveis:', err) }
    const editando = !!d
    openModal({
      title: editando ? '✏️ Editar desejo' : '🎁 Novo desejo',
      renderBody: (body, close) => {
        let clienteSel = editando && d.clienteId ? clientes.find(c => c.id === d.clienteId) || null : null
        const telInp = el('input', { type: 'text', class: 'field-input', placeholder: 'DDD + número', value: d?.telefone || '' })
        const cliAc = createAutocomplete({
          placeholder: 'Buscar cliente...', items: clientes.map(c => c.name), initialValue: d?.cliente || '',
          onSelect: v => {
            const c = clientes.find(c => c.name === v)
            clienteSel = c || null
            if (c?.phone) telInp.value = c.phone
          },
        })
        const modeloAc = createAutocomplete({
          placeholder: 'Ex: iPhone 17 Pro Max', items: NOMES_MODELOS, initialValue: d?.modelo || '',
          onSelect: () => atualizarCores(),
        })
        const capSel = el('select', { class: 'field-select' },
          el('option', { value: '' }, 'Qualquer'), ...CAPACIDADES.map(c => el('option', { value: c }, c)))
        capSel.value = d?.capacidade || ''
        const listaCores = el('datalist', { id: 'desejos-cores' })
        const corInp = el('input', { type: 'text', class: 'field-input', list: 'desejos-cores', placeholder: 'Qualquer', value: d?.cor || '' })
        const atualizarCores = () => listaCores.replaceChildren(...coresOficiais(modeloAc.getValue()).map(c => el('option', { value: c })))
        modeloAc.el.addEventListener('input', atualizarCores)
        atualizarCores()
        const obsInp = el('textarea', { class: 'field-input', rows: '2', placeholder: 'Ex: aceita seminovo, até R$ 7.000...' })
        obsInp.value = d?.observacoes || ''

        const cancelar = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelar.addEventListener('click', close)
        const salvar = el('button', { type: 'button', class: 'btn btn-primary' }, editando ? 'Salvar alterações' : 'Salvar desejo')
        salvar.addEventListener('click', async () => {
          const nome = cliAc.getValue().trim()
          const modelo = modeloAc.getValue().trim()
          if (!nome) return toastError('Informe o cliente.')
          if (!modelo) return toastError('Informe o aparelho desejado.')
          const c = clienteSel && clienteSel.name === nome ? clienteSel : clientes.find(c => c.name === nome) || null
          const dados = {
            clienteId: c?.id || null, cliente: nome, telefone: telInp.value, modelo,
            capacidade: capSel.value, cor: corInp.value, observacoes: obsInp.value,
          }
          salvar.disabled = true
          try {
            if (editando) await updateDesejo(d.id, dados); else await createDesejo(dados)
            toastSuccess(editando ? 'Desejo atualizado.' : 'Desejo cadastrado.')
            close()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar o desejo.')
            salvar.disabled = false
          }
        })

        mount(body,
          el('div', { class: 'field' }, el('label', {}, 'Cliente'), cliAc.el),
          el('div', { class: 'field' }, el('label', {}, 'Telefone (para avisar)'), telInp),
          el('div', { class: 'field' }, el('label', {}, 'Aparelho desejado'), modeloAc.el),
          el('div', { class: 'field' }, el('label', {}, 'Capacidade'), capSel),
          el('div', { class: 'field' }, el('label', {}, 'Cor'), corInp, listaCores),
          el('div', { class: 'field' }, el('label', {}, 'Observações'), obsInp),
          el('div', { class: 'modal-footer' }, cancelar, salvar),
        )
      },
    })
  }

  const novoBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Novo desejo')
  novoBtn.style.display = canCreate ? '' : 'none'
  novoBtn.addEventListener('click', () => abrirForm())

  mount(container,
    toolbarCard(novoBtn, searchWithIcon(buscaInp), filtroSel),
    avisoEstoque, tableWrap, vazio,
  )
  renderRows()

  return { update(novos, unidadesNovas, indisponivel) { todos = novos; estoque = unidadesNovas; semEstoque = indisponivel; renderRows() } }
}
