import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { brl, shortDate, maskMoeda, moedaParaNumero } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import {
  deletePedido, patchPedido, confirmarPagamento, confirmarPagamentoSemCompra, efetuarCompra,
  definirLogistica, salvarRoteiro, marcarEntregue, produtoLabel,
} from './service.js'
import { renderPedidoForm } from './form.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import {
  montarDadosRecibo, renderReciboPreview, garantirNumeroRecibo,
  toWhatsappNumber, enviarReciboFila, FILA_STATUS_LABEL, criarBotaoImprimir,
  imprimirReciboAutomaticamente,
} from '../../shared/components/Recibo.js'
import { abrirDetalhesModal, tornarLinhaClicavel } from '../../shared/components/DetalhesModal.js'

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
  recibo:  ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2', 'M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'M9 12h6M9 16h4'],
  send:    ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
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
  const lines = dataISO ? [`📆 *${fmtDateBR(dataISO)}*`, '🏍️ *ROTEIRO — Baruk*', ''] : ['🏍️ *ROTEIRO — Baruk*', '']
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
export function renderPedidoList(container, pedidos, { clientes, produtosCatalogo, fornecedores, usuariosPorUid = {}, empresa = {} }) {
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
      const pros = (p.produtos || []).map(pr => [pr.nome, pr.aparelho].filter(Boolean).join(' ')).join(' ').toLowerCase()
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
        if (pr.tipo === 'manutencao') {
          prodsCell.appendChild(
            el('div', { class: 'pedido-produto-line' },
              el('span', { class: 'dot' }, '🛠️'),
              el('span', { class: 'pedido-produto-nome' }, produtoLabel(pr) || '—'),
            )
          )
          return
        }
        const info = produtoLabel(pr)
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

      if (PAID_STATUSES.has(p.status)) {
        actionsInner.appendChild(actionBtn('recibo', 'Recibo', 'btn-outline', () => abrirReciboModal(p)))
      }

      if (canEdit && p.status === 'negociando') {
        actionsInner.appendChild(actionBtn('arrow', 'Pagamento', 'btn-outline-blue', () => advanceStatus(p.id, 'aguardando_pagamento')))
        actionsInner.appendChild(actionBtn('x', 'Excluir', 'btn-danger-outline', () => cancelarPedido(p)))
      }

      if (canEdit && p.status === 'aguardando_pagamento') {
        actionsInner.appendChild(actionBtn('check', 'Confirmar Pgto', 'btn-success', () => abrirPerguntaCompraModal(p)))
        actionsInner.appendChild(actionBtn('x', 'Excluir', 'btn-danger-outline', () => cancelarPedido(p)))
      }

      // A compra pendente segue disponível em qualquer status já pago, não só
      // em "pago": o pedido confirmado com "efetuar compra depois" costuma
      // avançar pra logística antes de alguém lançar o custo, e se o botão
      // sumisse aí a compra ficaria sem registro pra sempre — venda sem custo,
      // furo no CMV e no lucro do DRE.
      if (canEdit && PAID_STATUSES.has(p.status) && !p.compraFeita) {
        actionsInner.appendChild(actionBtn('check', 'Efetuar Compra', 'btn-success', () => abrirConfirmarPagamentoModal(p, { jaConfirmado: true })))
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
      tornarLinhaClicavel(row, () => abrirDetalhesPedidoModal(p))
      tbody.appendChild(row)
    })
  }

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function advanceStatus(id, status) {
    try { await patchPedido(id, { status }); toastSuccess('Status atualizado.') }
    catch { toastError('Erro ao atualizar status.') }
  }

  // ── Pergunta pós-pagamento: efetuar compra agora ou deixar pra depois ─────
  // "Sim" segue pro form de sempre (gera Compra + Venda junto com o pagamento).
  // "Não" só marca o pedido como pago — sem Compra nem Venda ainda — e um botão
  // "Efetuar Compra" fica disponível no pedido pra lançar isso depois. Existe
  // pra parar de forçar o preenchimento de fornecedor/custo toda vez que um
  // pedido já comprado precisa ser editado e o pagamento reconfirmado.
  function abrirPerguntaCompraModal(pedido) {
    openModal({
      title: 'Confirmar Pagamento',
      size:  'sm',
      renderBody: (body, closeModal) => {
        const p = el('p', { class: 'confirm-message' }, 'Deseja efetuar a compra agora?')

        const naoBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Não, só confirmar pagamento')
        naoBtn.addEventListener('click', async () => {
          naoBtn.disabled = true; naoBtn.textContent = 'Aguarde...'
          try {
            await confirmarPagamentoSemCompra(pedido)
            toastSuccess('Pagamento confirmado. Efetue a compra quando quiser.')
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao confirmar pagamento.')
            naoBtn.disabled = false; naoBtn.textContent = 'Não, só confirmar pagamento'
          }
        })

        const simBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Sim, efetuar compra agora')
        simBtn.addEventListener('click', () => { closeModal(); abrirConfirmarPagamentoModal(pedido) })

        mount(body, p, el('div', { class: 'modal-footer' }, naoBtn, simBtn))
      },
    })
  }

  // ── Modal confirmar pagamento (gera Compra + Venda de cada item) ──────────
  // jaConfirmado=true: pedido já está pago (veio do botão "Efetuar Compra"),
  // então só gera Compra+Venda, sem reconfirmar o pagamento.
  function abrirConfirmarPagamentoModal(pedido, { jaConfirmado = false } = {}) {
    const fornecedorNomes = fornecedores.map(f => f.box ? `${f.name} - ${f.box}` : f.name)

    openModal({
      title: jaConfirmado ? 'Efetuar Compra' : 'Confirmar Pagamento',
      size:  'lg',
      renderBody: (body, closeModal) => {
        const itens = pedido.produtos.map(() => ({ fornecedor: '', custo: '', observacoes: '' }))

        const itemBlocks = pedido.produtos.map((p, i) => {
          const fornAc = createAutocomplete({
            placeholder: 'Fornecedor',
            items:       fornecedorNomes,
            onSelect:    v => { itens[i].fornecedor = v },
          })
          fornAc.el.style.width = '100%'
          fornAc.el.addEventListener('input', () => { itens[i].fornecedor = fornAc.getValue() })

          const custoInp = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'R$ 0' })
          custoInp.addEventListener('input', () => {
            custoInp.value = maskMoeda(custoInp.value)
            itens[i].custo = moedaParaNumero(custoInp.value)
          })

          const aparelhoInp = el('textarea', { rows: '3', class: 'field-textarea',
            placeholder: 'Specs, serial, IMEI... (se já souber — aparece no recibo do cliente)' })
          aparelhoInp.addEventListener('input', () => { itens[i].observacoes = aparelhoInp.value })

          return el('div', { class: 'form-produto-block' },
            el('div', { class: 'form-produto-header' },
              el('span', { class: 'form-produto-label' }, produtoLabel(p) || `Item ${i + 1}`),
              el('span', { class: 'text-muted' }, `Venda: ${brl(p.valor || 0)}`),
            ),
            el('div', { class: 'form-grid' },
              el('div', { class: 'field field-full' }, el('label', {}, 'Fornecedor'), fornAc.el),
              el('div', { class: 'field' }, el('label', {}, 'Custo R$'), custoInp),
              el('div', { class: 'field field-full' }, el('label', {}, 'Dados do aparelho'), aparelhoInp),
            )
          )
        })

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', closeModal)
        const okLabel = jaConfirmado ? 'Efetuar Compra' : 'Confirmar Pagamento'
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, okLabel)
        okBtn.addEventListener('click', async () => {
          const faltando = itens.some(it => !it.fornecedor.trim() || it.custo === '')
          if (faltando) { toastError('Informe fornecedor e custo de cada item.'); return }
          okBtn.disabled = true; okBtn.textContent = 'Aguarde...'
          try {
            if (jaConfirmado) {
              await efetuarCompra(pedido, itens)
              toastSuccess('Compra e venda geradas.')
            } else {
              await confirmarPagamento(pedido, itens)
              toastSuccess('Pagamento confirmado. Compra e venda geradas.')
            }
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar.')
            okBtn.disabled = false; okBtn.textContent = okLabel
          }
        })

        mount(body,
          el('p', { class: 'text-muted', style: 'margin-bottom:12px;font-size:13px' },
            'Informe o fornecedor e o custo de cada item — a compra e a venda são geradas automaticamente.'),
          ...itemBlocks,
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      },
    })
  }

  // ── Recibo ────────────────────────────────────────────────────────────────
  async function montarReciboCompleto(pedido) {
    const numero = await garantirNumeroRecibo(pedido, patchPedido)
    const cliente = clientes.find(c => c.name === pedido.cliente)
    const vendedorNome = usuariosPorUid[pedido.criadoPor] || '—'
    const comprasSnap = await getDocs(query(collection(db, 'compras'), where('pedidoId', '==', pedido.id)))
    const comprasPedido = comprasSnap.docs.map(d => d.data())
    return montarDadosRecibo(pedido, { numero, empresa, cliente, vendedorNome, comprasPedido })
  }

  async function enviarReciboWhatsapp(pedido, dados) {
    const cliente = clientes.find(c => c.name === pedido.cliente)
    const telefone = toWhatsappNumber(cliente?.phone)
    if (!telefone) throw new Error('Cliente sem telefone cadastrado.')
    return enviarReciboFila({ dados, telefone, pedidoId: pedido.id })
  }

  function abrirReciboModal(pedido, { autoImprimir = false } = {}) {
    openModal({
      title: 'Recibo',
      size:  'lg',
      renderBody: (body, closeModal) => {
        mount(body, el('div', { class: 'loading' }, 'Montando recibo...'))

        montarReciboCompleto(pedido).then(dados => {
          const previewWrap = el('div', {})
          renderReciboPreview(previewWrap, dados)
          if (autoImprimir) imprimirReciboAutomaticamente(previewWrap)

          const cliente = clientes.find(c => c.name === pedido.cliente)
          const temTelefone = !!toWhatsappNumber(cliente?.phone)

          const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
          fecharBtn.addEventListener('click', () => { unsubFila?.(); closeModal() })

          const imprimirBtn = criarBotaoImprimir()

          const statusEl = el('span', { class: 'text-muted', style: 'margin-left:10px;font-size:13px' })

          let unsubFila = null
          const enviarBtn = actionBtn('send', 'Enviar por WhatsApp', 'btn-success', async () => {
            enviarBtn.disabled = true
            try {
              const ref = await enviarReciboWhatsapp(pedido, dados)
              toastSuccess('Enviado para a fila — o bot manda pro cliente em instantes.')
              statusEl.textContent = FILA_STATUS_LABEL.pendente
              unsubFila = onSnapshot(ref, snap => {
                const fila = snap.data()
                if (!fila) return
                statusEl.textContent = FILA_STATUS_LABEL[fila.status] || fila.status
                if (fila.status === 'erro') enviarBtn.disabled = false
              })
            } catch (err) {
              console.error(err)
              toastError(err.message || 'Erro ao enviar recibo.')
              enviarBtn.disabled = false
            }
          })
          if (!temTelefone) {
            enviarBtn.disabled = true
            statusEl.textContent = 'Cliente sem telefone cadastrado.'
          }

          mount(body,
            previewWrap,
            el('div', { class: 'modal-footer no-print' }, fecharBtn, imprimirBtn, enviarBtn, statusEl)
          )
        }).catch(err => {
          console.error(err)
          mount(body, el('p', { class: 'text-muted' }, 'Erro ao montar o recibo.'))
        })
      },
    })
  }

  // ── Detalhes (consulta) ──────────────────────────────────────────────────
  function abrirDetalhesPedidoModal(p) {
    const meta = STATUS_META[p.status] || { label: p.status || '—' }
    const valor = p.valorNegociado ?? p.totalVenda ?? 0
    const produtosTxt = (p.produtos || []).map(pr => produtoLabel(pr)).join(', ') || '—'
    const fps = Array.isArray(p.formasPagamento) ? p.formasPagamento : (p.formaPagamento ? [p.formaPagamento] : [])
    const pago = PAID_STATUSES.has(p.status)

    abrirDetalhesModal({
      title: 'Detalhes do Pedido',
      campos: [
        ['Cliente', p.cliente || p.clienteNome],
        ['Data', shortDate(p.dataContato || p.data || '')],
        ['Produtos', produtosTxt],
        ['Valor', brl(valor)],
        ['Forma de pagamento', fps.length ? fps.map(f => PAG_LABEL[f] || f).join(' + ') : '—'],
        ['Status', meta.label],
        p.observacoes ? ['Observações', p.observacoes] : null,
      ],
      onEditar:   canEdit ? () => openPedidoModal(p) : null,
      onImprimir: pago ? () => abrirReciboModal(p, { autoImprimir: true }) : null,
      onRecibo:   pago ? () => abrirReciboModal(p) : null,
    })
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
      message: `Excluir pedido de "${p.cliente || p.clienteNome}"? Compra(s), Venda e lançamentos financeiros vinculados também são excluídos. Não pode ser desfeito.`,
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
        let retiradas, entrega, isFresh = false

        if (saved && !Array.isArray(saved) && saved.retiradas) {
          retiradas = saved.retiradas.map(r => ({ ...r }))
          entrega   = { ...saved.entrega }
        } else if (Array.isArray(saved) && saved.length) {
          retiradas = saved.map(p => ({ item: p.retirada?.item || '', loja: p.retirada?.loja || '' }))
          entrega   = { endereco: saved[0]?.entrega?.endereco || '', cliente: pedido.cliente || '' }
        } else {
          isFresh = true
          retiradas = (pedido.produtos || [{}]).map(pr => ({
            item: [pr.nome, pr.cor].filter(Boolean).join(' '),
            loja: '',
          }))
          entrega = {
            endereco: enderecoDoCliente(pedido.cliente),
            cliente:  pedido.cliente || '',
          }
        }

        const fornecedorNomes = fornecedores.map(f => f.box ? `${f.name} - ${f.box}` : f.name)

        const retiradasWrap = el('div', { class: 'roteiro-paradas' })
        const previewEl = el('textarea', {
          class: 'roteiro-preview', readonly: '', rows: '7', spellcheck: 'false',
        })

        function getRoteiro() { return { retiradas, entrega } }

        const pedidoData = pedido.dataContato || pedido.data || ''
        function updatePreview() { previewEl.value = formatRoteiro(getRoteiro(), pedidoData) }

        function inp(val, onInput, placeholder, { title } = {}) {
          const i = el('input', { type: 'text', placeholder, class: title ? 'roteiro-item-inp' : '', title: title || val || '' })
          i.value = val || ''
          i.addEventListener('input', () => { onInput(i.value); if (!title) i.title = i.value; updatePreview() })
          return i
        }

        function lojaField(val, onInput) {
          const ac = createAutocomplete({
            placeholder:  'ex: Mohamed Ln229',
            items:        fornecedorNomes,
            initialValue: val || '',
            onSelect:     v => { onInput(v); updatePreview() },
          })
          ac.el.style.width = '100%'
          return ac
        }

        let lojaAcs = []
        function renderRetiradas() {
          retiradasWrap.replaceChildren()
          lojaAcs = []
          retiradas.forEach((r, i) => {
            const removeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline roteiro-remove-btn' }, '×')
            removeBtn.addEventListener('click', () => { retiradas.splice(i, 1); renderRetiradas(); updatePreview() })

            const lojaAc = lojaField(r.loja, v => { retiradas[i].loja = v })
            lojaAcs[i] = lojaAc

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
                      inp(r.item, v => { retiradas[i].item = v }, 'Produto a retirar', { title: r.item })),
                    el('div', { class: 'field' }, el('label', {}, 'Loja / Fornecedor'),
                      lojaAc.el),
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

        // Roteiro recém-gerado (ainda não editado/salvo): já sabemos o fornecedor
        // de cada item pela Compra feita na confirmação de pagamento — preenche
        // "Loja/Fornecedor" sozinho, sem precisar digitar de novo.
        if (isFresh) {
          getDocs(query(collection(db, 'compras'), where('pedidoId', '==', pedido.id)))
            .then(snap => {
              const comprasPedido = snap.docs.map(d => d.data())
              let mudou = false
              retiradas.forEach((r, i) => {
                if (r.loja) return
                const produtoOriginal = pedido.produtos?.[i]
                if (!produtoOriginal) return
                const label = produtoLabel(produtoOriginal)
                const compra = comprasPedido.find(c => c.produto === label)
                if (compra?.fornecedor) {
                  retiradas[i].loja = compra.fornecedor
                  lojaAcs[i]?.setValue(compra.fornecedor)
                  mudou = true
                }
              })
              if (mudou) updatePreview()
            })
            .catch(err => console.error('Erro ao buscar fornecedor da compra:', err))
        }
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
