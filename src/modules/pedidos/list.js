import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import {
  deletePedido, patchPedido, confirmarPagamento,
  definirLogistica, salvarRoteiro, marcarEntregue,
} from './service.js'
import { renderPedidoForm } from './form.js'

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_META = {
  negociando:           { label: 'Negociando',   cls: 'badge-negociando'    },
  aguardando_pagamento: { label: 'Aguard. Pgto', cls: 'badge-aguard-pgto'   },
  pago:                 { label: 'Pago',          cls: 'badge-pago'          },
  motoboy:              { label: '🏍️ Motoboy',    cls: 'badge-motoboy'       },
  retirada:             { label: '🏠 Retirada',   cls: 'badge-retirada'      },
  correio:              { label: '📬 Correio',    cls: 'badge-correio'       },
  entregue:             { label: '✅ Entregue',   cls: 'badge-entregue'      },
  cancelado:            { label: 'Cancelado',     cls: 'badge-cancelado'     },
}

const PAID_STATUSES   = new Set(['pago', 'motoboy', 'retirada', 'correio', 'entregue'])
const ACTIVE_STATUSES = new Set(['negociando', 'aguardando_pagamento'])
const DELIVERY_STATUSES = new Set(['motoboy', 'retirada', 'correio'])

const PAG_LABEL = { pix: '🏦 PIX', dinheiro: '💰 Dinheiro', cartao: '💳 Cartão', link: '🏪 Link' }
const PAG_ICON  = { pix: '🏦', dinheiro: '💰', cartao: '💳', link: '🏪' }

// ── Ícones SVG ────────────────────────────────────────────────────────────────
const PATHS = {
  edit:    ['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  arrow:   ['M5 12h14', 'M12 5l7 7-7 7'],
  check:   ['M20 6L9 17l-5-5'],
  checkOk: ['M22 11.08V12a10 10 0 11-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  truck:   ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7V8z', 'M5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', 'M18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z'],
  map:     ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z', 'M8 2v16', 'M16 6v16'],
  x:       ['M18 6L6 18', 'M6 6l12 12'],
  trash:   ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2'],
}

function ico(key, size = 13) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: size, height: size, style: 'flex-shrink:0;margin-right:4px;vertical-align:middle',
  })
  PATHS[key].forEach(d => svg.appendChild(svgEl('path', { d })))
  return svg
}

function actionBtn(iconKey, label, cls, onClick) {
  const btn = el('button', { type: 'button', class: `btn btn-sm ${cls}` })
  btn.append(ico(iconKey), label)
  btn.addEventListener('click', onClick)
  return btn
}

// ── Helpers de data ───────────────────────────────────────────────────────────
function monthKey(iso) { return iso ? iso.slice(0, 7) : '' }
function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function todayISO() { return new Date().toISOString().slice(0, 10) }
function weekRange() {
  const now = new Date()
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() + diff)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
}
function monthLabel(ym) {
  const [y, m] = ym.split('-')
  const ms = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${ms[+m - 1]} ${y}`
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Roteiro WhatsApp ──────────────────────────────────────────────────────────
function fmtDateBR(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatRoteiro({ retiradas = [], entrega = {} }, dataISO = '') {
  const lines = dataISO ? [`📆 ${fmtDateBR(dataISO)}`, '🏍️ *ROTEIRO — Baruk*', ''] : ['🏍️ *ROTEIRO — Baruk*', '']
  retiradas.forEach((r, i) => {
    lines.push(`📦 ↑ *RETIRADA ${i + 1}*`)
    if (r.item) lines.push(`• Item: ${r.item}`)
    if (r.loja) lines.push(`• Loja: ${r.loja}`)
    lines.push('')
  })
  lines.push('✅ ↓ *ENTREGA*')
  if (entrega.cliente)  lines.push(`• Cliente: ${entrega.cliente}`)
  if (entrega.endereco) lines.push(`• End: ${entrega.endereco}`)
  const itens = retiradas.map(r => r.item).filter(Boolean)
  if (itens.length)     lines.push(`• Itens: ${itens.join(', ')}`)
  return lines.join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function renderPedidoList(container, pedidos, { clientes, produtosCatalogo, fornecedores }) {
  const canCreate = can('pedidos', 'create')
  const canEdit   = can('pedidos', 'edit')
  const canDelete = can('pedidos', 'delete')

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalEl = el('div', { class: 'pedido-stat-value' })
  const valorEl = el('div', { class: 'pedido-stat-value green' })
  const pagosEl = el('div', { class: 'pedido-stat-value green' })
  const pendEl  = el('div', { class: 'pedido-stat-value' })
  const subLabel = el('span', {})

  function updateKpis(list, periodo) {
    const valor = list.reduce((s, p) => s + (p.valorNegociado || p.totalVenda || 0), 0)
    const pagos = list.filter(p => PAID_STATUSES.has(p.status)).length
    const pend  = list.filter(p => ACTIVE_STATUSES.has(p.status)).length
    totalEl.textContent = list.length
    valorEl.textContent = brl(valor)
    pagosEl.textContent = pagos
    pendEl.textContent  = pend
    pendEl.className    = 'pedido-stat-value ' + (pend > 0 ? 'red' : '')
    const pLabels = { hoje: 'hoje', semana: 'esta semana', mes: monthLabel(currentMonth) }
    subLabel.textContent = pLabels[periodo] || monthLabel(currentMonth)
  }

  let currentMonth = nowMonth()
  let periodoFiltro = 'mes'
  let sortCol = 'data'
  let sortDir = 'desc'

  function sortList(list) {
    return [...list].sort((a, b) => {
      let va, vb
      if (sortCol === 'data') {
        va = a.dataContato || a.data || ''; vb = b.dataContato || b.data || ''
      } else if (sortCol === 'cliente') {
        va = (a.cliente || a.clienteNome || '').toLowerCase()
        vb = (b.cliente || b.clienteNome || '').toLowerCase()
      } else if (sortCol === 'produto') {
        va = ((a.produtos || [])[0]?.nome || '').toLowerCase()
        vb = ((b.produtos || [])[0]?.nome || '').toLowerCase()
      } else if (sortCol === 'valor') {
        va = a.valorNegociado ?? a.totalVenda ?? 0
        vb = b.valorNegociado ?? b.totalVenda ?? 0
      } else if (sortCol === 'status') {
        va = a.status || ''; vb = b.status || ''
      } else { return 0 }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  // ── Abas de período (só mês atual) ───────────────────────────────────────
  const PERIODOS = [{ key: 'hoje', label: 'Hoje' }, { key: 'semana', label: 'Semana' }, { key: 'mes', label: 'Mês' }]
  const periodoBtns = PERIODOS.map(({ key, label }) => {
    const btn = el('button', { type: 'button', class: 'periodo-btn' + (key === periodoFiltro ? ' active' : '') }, label)
    btn.addEventListener('click', () => {
      periodoFiltro = key
      periodoBtns.forEach((b, i) => b.classList.toggle('active', PERIODOS[i].key === periodoFiltro))
      refresh()
    })
    return btn
  })
  const periodoRow = el('div', { class: 'periodo-row' }, ...periodoBtns)

  const monthNavLabel = el('span', { class: 'month-nav-label' })
  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); refresh() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); refresh() })

  const kpisRow = el('div', { class: 'pedidos-stats' },
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Pedidos'),   totalEl, el('div', { class: 'pedido-stat-sub' }, subLabel)),
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Negociado'), valorEl, el('div', { class: 'pedido-stat-sub' }, 'total')),
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Pagos'),     pagosEl, el('div', { class: 'pedido-stat-sub' }, 'confirmados')),
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Pendentes'), pendEl,  el('div', { class: 'pedido-stat-sub' }, 'negoc. + aguard.')),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar por cliente ou produto...' })
  searchInp.addEventListener('input', () => refresh())

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Novo Pedido')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => openPedidoModal(null))

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:10px;align-items:center' },
      newBtn,
      el('div', { class: 'month-nav' }, prevBtn, monthNavLabel, nextBtn)
    ),
    countBadge
  )

  // ── Tabela ────────────────────────────────────────────────────────────────
  const SORT_DEFS = [
    { key: 'data',    label: 'Data',     cls: '' },
    { key: 'cliente', label: 'Cliente',  cls: '' },
    { key: 'produto', label: 'Produtos', cls: '' },
    { key: 'valor',   label: 'Valor',    cls: 'th-money' },
    { key: null,      label: 'Pgto',     cls: '' },
    { key: 'status',  label: 'Status',   cls: '' },
  ]
  const sortThs = SORT_DEFS.map(({ key, label, cls }) => {
    const clsList = [cls, key ? 'th-sortable' : ''].filter(Boolean).join(' ')
    const ind = key ? el('span', { class: 'sort-ind' }, '') : null
    const th = el('th', { class: clsList }, label)
    if (ind) th.appendChild(ind)
    if (key) {
      th.addEventListener('click', () => {
        if (sortCol === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
        else { sortCol = key; sortDir = key === 'data' ? 'desc' : 'asc' }
        updateSortHeaders(); refresh()
      })
    }
    return th
  })

  function updateSortHeaders() {
    SORT_DEFS.forEach(({ key }, i) => {
      if (!key) return
      const th = sortThs[i]
      th.classList.toggle('sort-active', sortCol === key)
      const ind = th.querySelector('.sort-ind')
      if (ind) ind.textContent = sortCol === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    })
  }
  updateSortHeaders()

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {}, ...sortThs,
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, 'Ações')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhum pedido encontrado.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      canCreate ? 'Clique em "+ Novo Pedido" para começar.' : '')
  )

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = pedidos.filter(p => monthKey(p.dataContato || p.data || '') === currentMonth)
    if (currentMonth === nowMonth()) {
      if (periodoFiltro === 'hoje') {
        const today = todayISO()
        list = list.filter(p => (p.dataContato || p.data || '').slice(0, 10) === today)
      } else if (periodoFiltro === 'semana') {
        const { start, end } = weekRange()
        list = list.filter(p => { const d = (p.dataContato || p.data || '').slice(0, 10); return d >= start && d <= end })
      }
    }
    if (q) list = list.filter(p => {
      const cli  = (p.cliente || p.clienteNome || '').toLowerCase()
      const pros = (p.produtos || []).map(pr => pr.nome || '').join(' ').toLowerCase()
      return cli.includes(q) || pros.includes(q)
    })
    return sortList(list)
  }

  function refresh() {
    monthNavLabel.textContent = monthLabel(currentMonth)
    const isCurrent = currentMonth === nowMonth()
    periodoRow.style.display = isCurrent ? '' : 'none'
    if (!isCurrent) periodoFiltro = 'mes'
    const list = filteredList()
    countBadge.textContent = list.length
    updateKpis(list, isCurrent ? periodoFiltro : null)
    renderTable(list)
  }

  function renderTable(list) {
    tbody.replaceChildren()
    if (!list.length) {
      tableWrap.classList.add('hidden'); emptyState.classList.remove('hidden'); return
    }
    tableWrap.classList.remove('hidden'); emptyState.classList.add('hidden')

    list.forEach((p, rowIdx) => {
      const meta = STATUS_META[p.status] || { label: p.status || '—', cls: 'badge-negociando' }

      // Produtos
      const prodsCell = el('td', { class: 'td-produtos' })
      ;(p.produtos || []).forEach(pr => {
        const info = [pr.nome, pr.cor].filter(Boolean).join(' · ')
        prodsCell.appendChild(
          el('div', { class: 'pedido-produto-line' },
            el('span', { class: 'dot' }, '●'),
            el('span', { class: 'pedido-produto-nome' }, info || '—'),
          )
        )
        if (pr.acessorios?.length) {
          const sub = el('div', { class: 'pedido-produto-sub' })
          pr.acessorios.forEach(a => sub.appendChild(el('span', { class: 'acessorios-tag' }, a)))
          prodsCell.appendChild(sub)
        }
      })

      const valor = p.valorNegociado ?? p.totalVenda ?? 0

      // Ações
      const actionsInner = el('div', { class: 'td-actions-inner' })
      const actionsCell  = el('td', { class: 'col-actions' }, actionsInner)

      if (canEdit) {
        actionsInner.appendChild(actionBtn('edit', 'Editar', 'btn-outline', () => openPedidoModal(p)))
      }

      if (canEdit && p.status === 'negociando') {
        actionsInner.appendChild(actionBtn('arrow', 'Pagamento', 'btn-outline-blue', () => advanceStatus(p.id, 'aguardando_pagamento')))
        actionsInner.appendChild(actionBtn('x', 'Excluir', 'btn-danger-outline', () => cancelarPedido(p)))
      }

      if (canEdit && p.status === 'aguardando_pagamento') {
        actionsInner.appendChild(actionBtn('check', 'Confirmar Pgto', 'btn-success', () => confirmarPgto(p.id)))
        actionsInner.appendChild(actionBtn('x', 'Excluir', 'btn-danger-outline', () => cancelarPedido(p)))
      }

      if (canEdit && p.status === 'pago') {
        actionsInner.appendChild(actionBtn('truck', 'Logística', 'btn-outline-blue', () => abrirLogisticaModal(p)))
      }

      if (canEdit && p.status === 'motoboy') {
        actionsInner.appendChild(actionBtn('map', 'Roteiro', 'btn-outline-blue', () => abrirRoteiroModal(p)))
        actionsInner.appendChild(actionBtn('checkOk', 'Entregue', 'btn-success', () => confirmarEntrega(p.id)))
      }

      if (canEdit && (p.status === 'retirada' || p.status === 'correio')) {
        actionsInner.appendChild(actionBtn('checkOk', 'Entregue', 'btn-success', () => confirmarEntrega(p.id)))
      }

      if (canEdit && p.status === 'cancelado') {
        actionsInner.appendChild(actionBtn('arrow', 'Reabrir', 'btn-outline-blue', () => reabrirPedido(p.id)))
      }

      if (canDelete && p.status === 'cancelado') {
        actionsInner.appendChild(actionBtn('trash', 'Excluir', 'btn-danger-outline', () => confirmDelete(p)))
      }

      const row = el('tr', {},
        el('td', { class: 'td-date' }, shortDate(p.dataContato || p.data || '')),
        el('td', { class: 'td-name' }, p.cliente || p.clienteNome || '—'),
        prodsCell,
        el('td', { class: 'td-money' }, brl(valor)),
        el('td', { class: 'td-pgto' }, (() => {
          const fps = Array.isArray(p.formasPagamento) ? p.formasPagamento : (p.formaPagamento ? [p.formaPagamento] : [])
          return fps.length ? fps.map(f => PAG_ICON[f] || PAG_LABEL[f] || f).join(' ') : '—'
        })()),
        el('td', {}, el('span', { class: `status-badge ${meta.cls}` }, meta.label)),
        ...(canEdit || canDelete ? [actionsCell] : []),
      )
      tbody.appendChild(row)
    })
  }

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function advanceStatus(id, status) {
    try { await patchPedido(id, { status }); toastSuccess('Status atualizado.') }
    catch { toastError('Erro ao atualizar status.') }
  }

  async function confirmarPgto(id) {
    try { await confirmarPagamento(id); toastSuccess('Pagamento confirmado.') }
    catch { toastError('Erro ao confirmar pagamento.') }
  }

  function confirmarEntrega(id) {
    openConfirm({
      title: 'Confirmar entrega',
      message: 'O pedido foi entregue ao cliente?',
      confirmLabel: 'Sim, foi entregue',
      onConfirm: async () => {
        try { await marcarEntregue(id); toastSuccess('Pedido marcado como entregue.') }
        catch { toastError('Erro ao marcar entrega.') }
      },
    })
  }

  function cancelarPedido(p) {
    openConfirm({
      title: 'Cancelar pedido',
      message: `Cancelar pedido de "${p.cliente || p.clienteNome}"?`,
      confirmLabel: 'Cancelar pedido',
      danger: true,
      onConfirm: () => advanceStatus(p.id, 'cancelado'),
    })
  }

  async function reabrirPedido(id) {
    try { await patchPedido(id, { status: 'negociando' }); toastSuccess('Pedido reaberto.') }
    catch { toastError('Erro ao reabrir pedido.') }
  }

  function confirmDelete(p) {
    openConfirm({
      title: 'Excluir pedido',
      message: `Excluir pedido de "${p.cliente || p.clienteNome}"? Não pode ser desfeito.`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        try { await deletePedido(p.id); toastSuccess('Pedido excluído.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  // ── Modal logística ───────────────────────────────────────────────────────
  function abrirLogisticaModal(pedido) {
    openModal({
      title: 'Definir Entrega',
      size: 'sm',
      renderBody: (body, closeModal) => {
        async function escolher(tipo) {
          try {
            await definirLogistica(pedido.id, tipo)
            toastSuccess('Entrega definida.')
            closeModal()
            if (tipo === 'motoboy') setTimeout(() => abrirRoteiroModal({ ...pedido, status: 'motoboy', logistica: { tipo } }), 300)
          } catch { toastError('Erro ao definir entrega.') }
        }

        function optBtn(emoji, titulo, desc, tipo) {
          const btn = el('button', { type: 'button', class: 'logistica-opt-btn' })
          btn.append(
            el('div', { class: 'logistica-opt-icon' }, emoji),
            el('div', { class: 'logistica-opt-info' },
              el('strong', {}, titulo),
              el('span', {}, desc)
            )
          )
          btn.addEventListener('click', () => escolher(tipo))
          return btn
        }

        body.append(
          el('p', { style: 'margin-bottom:16px;font-size:14px;color:var(--color-muted)' }, 'Como será a entrega?'),
          el('div', { class: 'logistica-opts' },
            optBtn('🏍️', 'Motoboy', 'Entrega em domicílio — monta o roteiro', 'motoboy'),
            optBtn('🏠', 'Retirada', 'Cliente retira na loja', 'retirada'),
            optBtn('📬', 'Correio', 'Envio pelos Correios', 'correio'),
          )
        )
      },
    })
  }

  // ── Modal roteiro ─────────────────────────────────────────────────────────
  function enderecoDoCliente(nomeCliente) {
    const c = clientes.find(c => (c.name || '').toLowerCase() === (nomeCliente || '').toLowerCase())
    if (!c?.address) return ''
    const { logradouro, numero, complemento, bairro, cidade, estado } = c.address
    return [
      [logradouro, numero].filter(Boolean).join(', '),
      complemento,
      bairro,
      [cidade, estado].filter(Boolean).join(' - '),
    ].filter(Boolean).join(', ')
  }

  function abrirRoteiroModal(pedido) {
    openModal({
      title: '🏍️ Roteiro de Entrega',
      size: 'lg',
      renderBody: (body, closeModal) => {
        // Suporta formato novo {retiradas, entrega} e legado (array de paradas)
        const saved = pedido.logistica?.roteiro
        let retiradas, entrega

        if (saved && !Array.isArray(saved) && saved.retiradas) {
          retiradas = saved.retiradas.map(r => ({ ...r }))
          entrega   = { ...saved.entrega }
        } else if (Array.isArray(saved) && saved.length) {
          retiradas = saved.map(p => ({ item: p.retirada?.item || '', loja: p.retirada?.loja || '' }))
          entrega   = { endereco: saved[0]?.entrega?.endereco || '', cliente: pedido.cliente || '' }
        } else {
          retiradas = (pedido.produtos || [{}]).map(pr => ({
            item: [pr.nome, pr.cor].filter(Boolean).join(' '),
            loja: '',
          }))
          entrega = {
            endereco: enderecoDoCliente(pedido.cliente),
            cliente:  pedido.cliente || '',
          }
        }

        const retiradasWrap = el('div', { class: 'roteiro-paradas' })
        const previewEl = el('textarea', {
          class: 'roteiro-preview', readonly: '', rows: '7', spellcheck: 'false',
        })

        function getRoteiro() { return { retiradas, entrega } }

        const pedidoData = pedido.dataContato || pedido.data || ''
        function updatePreview() { previewEl.value = formatRoteiro(getRoteiro(), pedidoData) }

        function inp(val, onInput, placeholder) {
          const i = el('input', { type: 'text', placeholder })
          i.value = val || ''
          i.addEventListener('input', () => { onInput(i.value); updatePreview() })
          return i
        }

        function renderRetiradas() {
          retiradasWrap.replaceChildren()
          retiradas.forEach((r, i) => {
            const removeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline roteiro-remove-btn' }, '×')
            removeBtn.addEventListener('click', () => { retiradas.splice(i, 1); renderRetiradas(); updatePreview() })

            retiradasWrap.appendChild(
              el('div', { class: 'roteiro-parada' },
                el('div', { class: 'roteiro-parada-header' },
                  el('span', { class: 'roteiro-parada-num' }, `Retirada ${i + 1}`),
                  retiradas.length > 1 ? removeBtn : el('span', {})
                ),
                el('div', { class: 'roteiro-section roteiro-retirada' },
                  el('div', { class: 'roteiro-section-title' }, '↑ Retirada'),
                  el('div', { class: 'roteiro-fields' },
                    el('div', { class: 'field' }, el('label', {}, 'Item'),
                      inp(r.item, v => { retiradas[i].item = v }, 'Produto a retirar')),
                    el('div', { class: 'field' }, el('label', {}, 'Loja / Fornecedor'),
                      inp(r.loja, v => { retiradas[i].loja = v }, 'ex: Mohamed Ln229')),
                  )
                )
              )
            )
          })
        }

        // Entrega única
        const enderecoInp = el('input', { type: 'text', placeholder: 'Rua, número, bairro...' })
        enderecoInp.value = entrega.endereco || ''
        enderecoInp.addEventListener('input', () => { entrega.endereco = enderecoInp.value; updatePreview() })

        const clienteInp = el('input', { type: 'text', placeholder: 'Nome do cliente' })
        clienteInp.value = entrega.cliente || ''
        clienteInp.addEventListener('input', () => { entrega.cliente = clienteInp.value; updatePreview() })

        const entregaSection = el('div', { class: 'roteiro-parada roteiro-entrega-unica' },
          el('div', { class: 'roteiro-section roteiro-entrega' },
            el('div', { class: 'roteiro-section-title' }, '↓ Entrega'),
            el('div', { class: 'roteiro-fields' },
              el('div', { class: 'field' }, el('label', {}, 'Endereço'), enderecoInp),
              el('div', { class: 'field' }, el('label', {}, 'Cliente'), clienteInp),
            )
          )
        )

        const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Retirada')
        addBtn.addEventListener('click', () => {
          retiradas.push({ item: '', loja: '' })
          renderRetiradas()
          updatePreview()
        })

        const copyBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '📋 Copiar')
        copyBtn.addEventListener('click', () => {
          const text = previewEl.value
          const done = () => {
            copyBtn.textContent = '✓ Copiado!'
            setTimeout(() => { copyBtn.textContent = '📋 Copiar' }, 2000)
          }
          const fallback = () => {
            const tmp = document.createElement('textarea')
            tmp.value = text
            tmp.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
            document.body.appendChild(tmp)
            tmp.focus()
            tmp.select()
            try { document.execCommand('copy') } catch (_) {}
            document.body.removeChild(tmp)
            done()
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(fallback)
          } else {
            fallback()
          }
        })

        const waBtn = el('button', { type: 'button', class: 'btn btn-success' }, '📱 WhatsApp')
        waBtn.addEventListener('click', () => {
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(previewEl.value)}`, '_blank')
        })

        const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
          try {
            await salvarRoteiro(pedido.id, getRoteiro())
            toastSuccess('Roteiro salvo.')
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar roteiro.')
            saveBtn.disabled = false; saveBtn.textContent = 'Salvar'
          }
        })

        renderRetiradas()
        updatePreview()

        mount(body,
          retiradasWrap,
          entregaSection,
          el('div', { class: 'roteiro-preview-wrap' },
            el('div', { class: 'roteiro-preview-label' }, 'Prévia da mensagem'),
            previewEl,
          ),
          el('div', { class: 'roteiro-footer' },
            el('div', { style: 'display:flex;gap:8px' }, addBtn, copyBtn),
            el('div', { style: 'display:flex;gap:8px' }, waBtn, saveBtn),
          )
        )
      },
    })
  }

  // ── Pedido modal ──────────────────────────────────────────────────────────
  function openPedidoModal(p) {
    openModal({
      title: p ? 'Editar Pedido' : 'Novo Pedido',
      size:  'lg',
      renderBody: (body, close) => renderPedidoForm(body, close, p, { clientes, produtosCatalogo, fornecedores }),
    })
  }

  mount(container, periodoRow, kpisRow, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return { update(newPedidos) { pedidos = newPedidos; refresh() } }
}
