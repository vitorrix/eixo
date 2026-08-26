import { el, mount } from '../../shared/utils/dom.js'
import { toolbarCard, toolbarMeta, searchWithIcon } from '../../shared/components/ToolbarCard.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { presetRange } from '../../shared/utils/periodo.js'
import { STATUS_META, DISCARD_REASON_META } from './constants.js'

function toDate(ts) {
  if (!ts) return null
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
}

function dataISO(ts) {
  const d = toDate(ts)
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

// sem_resposta entra aqui também: se ficasse só em novo/em_followup, um lead
// marcado "sem resposta" desapareceria das 3 telas — o Histórico é onde dá
// pra auditar todo lead que não virou negócio, seja qual for o motivo.
const STATUS_HISTORICO = ['descartado', 'convertido', 'sem_resposta']

export function renderLeadsHistorico(container, leads) {
  let periodo = presetRange('este-mes')
  let motivoFiltro = 'todos'
  let busca = ''

  const picker = createPeriodoPicker({ initialPreset: 'este-mes', onChange: p => { periodo = p; refresh() } })

  const motivoSel = el('select', { class: 'field-select' },
    el('option', { value: 'todos' }, 'Todos os motivos'),
    ...Object.entries(DISCARD_REASON_META).map(([key, label]) => el('option', { value: key }, label)),
  )
  motivoSel.addEventListener('change', () => { motivoFiltro = motivoSel.value; refresh() })

  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar por nome ou telefone...' })
  searchInp.addEventListener('input', () => { busca = searchInp.value.trim().toLowerCase(); refresh() })

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = toolbarCard(picker.el, motivoSel, searchWithIcon(searchInp), toolbarMeta(countBadge))

  const kpisWrap = el('div', { class: 'pedidos-stats' })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Data'), el('th', {}, 'Nome/Telefone'), el('th', {}, 'Status'),
      el('th', {}, 'Motivo'), el('th', {}, 'Nota'),
    )),
    tbody,
  )
  const tableWrap = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state' }, el('p', {}, 'Nada encontrado nesse período.') )

  function kpiCard(label, value) {
    return el('div', { class: 'pedido-stat' },
      el('div', { class: 'pedido-stat-label' }, label),
      el('div', { class: 'pedido-stat-value' }, String(value)),
    )
  }

  function refresh() {
    let filtrados = leads.filter(l => {
      if (!STATUS_HISTORICO.includes(l.status)) return false
      const dISO = dataISO(l.updatedAt || l.createdAt)
      if (!dISO || dISO < periodo.de || dISO > periodo.ate) return false
      if (motivoFiltro !== 'todos' && l.discardReason !== motivoFiltro) return false
      if (busca) {
        const alvo = `${l.name || ''} ${l.phone || ''}`.toLowerCase()
        if (!alvo.includes(busca)) return false
      }
      return true
    })
    filtrados.sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0))

    countBadge.textContent = `${filtrados.length} lead${filtrados.length === 1 ? '' : 's'}`

    const convertidos = filtrados.filter(l => l.status === 'convertido').length
    const descartados = filtrados.filter(l => l.status === 'descartado').length
    const semResposta = filtrados.filter(l => l.status === 'sem_resposta').length
    kpisWrap.replaceChildren(
      kpiCard('Total no período', filtrados.length),
      kpiCard('Convertidos', convertidos),
      kpiCard('Descartados', descartados),
      kpiCard('Sem resposta', semResposta),
    )

    tableWrap.style.display = filtrados.length ? '' : 'none'
    emptyState.style.display = filtrados.length ? 'none' : ''

    tbody.replaceChildren(...filtrados.map(l => {
      const statusMeta = STATUS_META[l.status] || STATUS_META.novo
      return el('tr', {},
        el('td', { class: 'td-date' }, shortDate(l.updatedAt || l.createdAt)),
        el('td', {}, l.name || l.phone || '—'),
        el('td', {}, el('span', { class: `badge ${statusMeta.cls}` }, statusMeta.label)),
        el('td', {}, l.discardReason ? (DISCARD_REASON_META[l.discardReason] || l.discardReason) : '—'),
        el('td', { class: 'td-name', title: l.discardNote || '' }, l.discardNote || '—'),
      )
    }))
  }

  mount(container, toolbar, kpisWrap, tableWrap, emptyState)
  refresh()

  return { update(newLeads) { leads = newLeads; refresh() } }
}
