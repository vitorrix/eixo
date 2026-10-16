import { el, mount } from '../../shared/utils/dom.js'
import { toolbarCard, toolbarMeta, searchWithIcon } from '../../shared/components/ToolbarCard.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { presetRange, isoLocal } from '../../shared/utils/periodo.js'
import { STATUS_META, DISCARD_REASON_META, nomeExibicao, canalDoLead, canalIcon } from './constants.js'
import { buildKpisPorCanal } from './kpisPorCanal.js'
import { abrirHistoricoLead } from './historicoLeadModal.js'
import { tornarLinhaClicavel } from '../../shared/components/DetalhesModal.js'

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
  let statusFiltro = 'todos'
  let busca = ''

  const picker = createPeriodoPicker({ initialPreset: 'este-mes', onChange: p => { periodo = p; refresh() } })

  const motivoSel = el('select', { class: 'field-select' },
    el('option', { value: 'todos' }, 'Todos os motivos'),
    ...Object.entries(DISCARD_REASON_META).map(([key, label]) => el('option', { value: key }, label)),
  )
  motivoSel.addEventListener('change', () => { motivoFiltro = motivoSel.value; refresh() })

  const statusSel = el('select', { class: 'field-select' },
    el('option', { value: 'todos' }, 'Todos os status'),
    ...STATUS_HISTORICO.map(st => el('option', { value: st }, STATUS_META[st]?.label || st)),
  )
  statusSel.addEventListener('change', () => { statusFiltro = statusSel.value; refresh() })

  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar por nome ou telefone...' })
  searchInp.addEventListener('input', () => { busca = searchInp.value.trim().toLowerCase(); refresh() })

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = toolbarCard(picker.el, statusSel, motivoSel, searchWithIcon(searchInp), toolbarMeta(countBadge))

  // Painel de números por canal (WhatsApp e Instagram separados) — o quadro
  // em si mistura os dois nas mesmas colunas, mas pra saber "quanto veio de
  // cada canal" precisa contar cada um à parte. Mesmo componente do Quadro.
  const kpisWrap = el('div', {})
  const kpis = buildKpisPorCanal(kpisWrap, [], { totalLabel: 'Total no período' })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Data'), el('th', {}, 'Canal'), el('th', {}, 'Nome/Telefone'), el('th', {}, 'Status'),
      el('th', {}, 'Motivo'), el('th', {}, 'Nota'), el('th', {}, 'Tentativas'), el('th', {}, ''),
    )),
    tbody,
  )
  const tableWrap = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state' }, el('p', {}, 'Nada encontrado nesse período.') )

  function refresh() {
    let filtrados = leads.filter(l => {
      if (!STATUS_HISTORICO.includes(l.status)) return false
      if (statusFiltro !== 'todos' && l.status !== statusFiltro) return false
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

    kpis.update(filtrados)

    tableWrap.style.display = filtrados.length ? '' : 'none'
    emptyState.style.display = filtrados.length ? 'none' : ''

    tbody.replaceChildren(...filtrados.map(l => {
      const statusMeta = STATUS_META[l.status] || STATUS_META.novo
      const verBtn = el('button', { type: 'button', class: 'btn-link' }, 'Ver atendimento')
      verBtn.addEventListener('click', () => abrirHistoricoLead(l))
      const row = el('tr', {},
        el('td', { class: 'td-date' }, shortDate(l.updatedAt || l.createdAt)),
        el('td', { class: 'lead-td-canal' }, canalIcon(canalDoLead(l))),
        el('td', {}, nomeExibicao(l)),
        el('td', {}, el('span', { class: `badge ${statusMeta.cls}` }, statusMeta.label)),
        el('td', {}, l.discardReason ? (DISCARD_REASON_META[l.discardReason] || l.discardReason) : '—'),
        el('td', { class: 'td-name', title: l.discardNote || '' }, l.discardNote || '—'),
        el('td', { class: 'col-center' }, String(l.notes?.length || 0)),
        el('td', { class: 'col-actions' }, verBtn),
      )
      tornarLinhaClicavel(row, () => abrirHistoricoLead(l))
      return row
    }))
  }

  mount(container, toolbar, kpisWrap, tableWrap, emptyState)
  refresh()

  return {
    update(newLeads) { leads = newLeads; refresh() },
    // Chamado pelo "+N no Histórico" do Quadro: abre já no status da coluna e
    // sem limite de período (o quadro mostra só os primeiros, o resto é antigo).
    mostrar(status) {
      statusFiltro = STATUS_HISTORICO.includes(status) ? status : 'todos'
      statusSel.value = statusFiltro
      motivoFiltro = 'todos'
      motivoSel.value = 'todos'
      picker.setRange('2000-01-01', isoLocal(new Date()))
    },
  }
}
