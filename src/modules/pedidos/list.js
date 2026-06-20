import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { deletePedido } from './service.js'
import { renderPedidoForm } from './form.js'

const STATUS_CHIP = {
  aguardando: { label: 'Aguardando Pgto', cls: 'chip-aguardando' },
  pago:       { label: 'Pago',            cls: 'chip-pago'       },
  logistica:  { label: 'Em Logística',    cls: 'chip-logistica'  },
  entregue:   { label: 'Entregue',        cls: 'chip-entregue'   },
  pos_venda:  { label: 'Pós-venda',       cls: 'chip-pos_venda'  },
}

const LOG_LABEL = { motoboy: 'Motoboy', correio: 'Correios', retirada: 'Retirada' }

function monthKey(iso) { return iso ? iso.slice(0, 7) : '' }
function monthLabel(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

function calcStats(pedidos, month) {
  const list = pedidos.filter(p => monthKey(p.data) === month)
  const fat   = list.reduce((s, p) => s + (p.totalVenda  || 0), 0)
  const mar   = list.reduce((s, p) => s + (p.totalMargem || 0), 0)
  const pend  = list.filter(p => p.statusEntrega !== 'entregue').length
  return {
    count:       list.length,
    faturamento: fat,
    margem:      mar,
    ticket:      list.length ? Math.round(fat / list.length) : 0,
    pendentes:   pend,
  }
}

function statCard(label, valueEl, sub) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    valueEl,
    el('div', { class: 'pedido-stat-sub' }, sub)
  )
}

export function renderPedidoList(container, pedidos, { clientes, fornecedores, operacoes }) {
  const canCreate = can('pedidos', 'create')
  const canEdit   = can('pedidos', 'edit')
  const canDelete = can('pedidos', 'delete')

  const formasPagamento = operacoes?.formasPagamento || []

  // ── Mês atual ─────────────────────────────────────────────────────────────
  const now = new Date()
  let currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ── Stat cards ────────────────────────────────────────────────────────────
  const countEl   = el('div', { class: 'pedido-stat-value' })
  const fatEl     = el('div', { class: 'pedido-stat-value green' })
  const marEl     = el('div', { class: 'pedido-stat-value green' })
  const ticketEl  = el('div', { class: 'pedido-stat-value' })
  const pendEl    = el('div', { class: 'pedido-stat-value' })
  const monthLabelEl = el('span', { class: 'month-nav-label' })

  function updateStats() {
    monthLabelEl.textContent = monthLabel(currentMonth)
    const s = calcStats(pedidos, currentMonth)
    countEl.textContent  = s.count
    fatEl.textContent    = brl(s.faturamento)
    marEl.textContent    = brl(s.margem)
    ticketEl.textContent = brl(s.ticket)
    pendEl.textContent   = s.pendentes
    pendEl.className     = 'pedido-stat-value ' + (s.pendentes > 0 ? 'red' : '')
    renderTable()
  }

  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); updateStats() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); updateStats() })

  const statsRow = el('div', { class: 'pedidos-stats' },
    statCard('Pedidos',       countEl,  monthLabelEl.cloneNode(true)),
    statCard('Faturamento',   fatEl,    'receita do mês'),
    statCard('Margem Bruta',  marEl,    'lucro acumulado'),
    statCard('Ticket Médio',  ticketEl, 'por pedido'),
    statCard('Pendentes',     pendEl,   'não entregues'),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Novo Pedido')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => openPedidoModal(null))

  const monthNav = el('div', { class: 'month-nav' },
    prevBtn, monthLabelEl, nextBtn
  )

  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:10px;align-items:center' },
      newBtn, monthNav
    ),
    el('span', { class: 'count-badge', id: 'pedido-count' }, String(pedidos.length))
  )

  // ── Table ─────────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table pedidos-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produtos'),
        el('th', {}, 'Acessórios'),
        el('th', { class: 'th-money' }, 'Custo'),
        el('th', { class: 'th-money' }, 'Venda'),
        el('th', { class: 'th-money' }, 'Margem'),
        el('th', {}, 'Status'),
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, '')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhum pedido neste mês.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      canCreate ? 'Clique em "+ Novo Pedido" para começar.' : '')
  )

  function renderTable() {
    tbody.replaceChildren()
    const monthPedidos = pedidos.filter(p => monthKey(p.data) === currentMonth)
    document.getElementById('pedido-count').textContent = monthPedidos.length

    if (!monthPedidos.length) {
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')

    let lastDate = null
    for (const p of monthPedidos) {
      // Date group header
      if (p.data !== lastDate) {
        lastDate = p.data
        const hdr = document.createElement('tr')
        const td  = document.createElement('td')
        td.colSpan = 9
        td.className = 'pedidos-date-header'
        td.textContent = formatFullDate(p.data)
        hdr.appendChild(td)
        tbody.appendChild(hdr)
      }

      // Produtos cell
      const produtosCell = el('td', { class: 'td-produtos' })
      ;(p.produtos || []).forEach(pr => {
        const lucro   = pr.lucro || 0
        const lucroEl = el('span', { class: 'pedido-lucro ' + (lucro >= 0 ? 'pos' : 'neg') },
          (lucro >= 0 ? '+' : '') + brl(lucro)
        )
        const line = el('div', { class: 'pedido-produto-line' },
          el('span', { class: 'dot' }, '●'),
          el('span', { class: 'pedido-produto-nome' }, pr.nome || '—'),
        )
        const sub = el('div', { class: 'pedido-produto-sub' })
        if (pr.fornecedorNome) sub.appendChild(el('span', { class: 'pedido-forn' }, pr.fornecedorNome))
        sub.appendChild(el('span', { class: 'pedido-financials' },
          ` custo ${brl(pr.custo)} → venda ${brl(pr.venda)} `,
        ))
        sub.appendChild(lucroEl)
        produtosCell.appendChild(line)
        produtosCell.appendChild(sub)
      })

      // Acessórios cell
      const acessCell = el('td', { class: 'td-acessorios' })
      if (p.acessorios?.length) {
        p.acessorios.forEach(a => acessCell.appendChild(el('span', { class: 'acessorios-tag' }, a)))
      } else {
        acessCell.textContent = '—'
      }

      // Status cell
      const chip = STATUS_CHIP[p.statusEntrega] || { label: p.statusEntrega, cls: 'chip-default' }
      const statusCell = el('td', { class: 'td-status' })
      statusCell.appendChild(el('span', { class: `pedido-chip ${chip.cls}` }, chip.label))
      if (p.pagamento) statusCell.appendChild(el('span', { class: 'pedido-chip chip-default' }, p.pagamento))
      if (p.logistica) statusCell.appendChild(el('span', { class: 'pedido-chip chip-default' }, LOG_LABEL[p.logistica] || p.logistica))
      if (p.sistemaOk) statusCell.appendChild(el('span', { class: 'pedido-chip chip-ok' }, '✓ Sistema'))
      if (p.notaEnviada) statusCell.appendChild(el('span', { class: 'pedido-chip chip-ok' }, '✓ Nota'))
      if (p.inclui_troca) statusCell.appendChild(el('span', { class: 'pedido-chip chip-troca' }, '⇄ Troca'))

      const row = el('tr', {},
        el('td', { class: 'td-date' }, shortDate(p.data)),
        el('td', { class: 'td-name' }, p.clienteNome || '—'),
        produtosCell,
        acessCell,
        el('td', { class: 'td-money' }, brl(p.totalCusto)),
        el('td', { class: 'td-money' }, brl(p.totalVenda)),
        el('td', { class: 'td-money money-margem' }, (p.totalMargem >= 0 ? '+' : '') + brl(p.totalMargem)),
        statusCell,
      )

      if (canEdit || canDelete) {
        const actions = el('td', { class: 'td-actions' })
        if (canEdit) {
          const editBtn = el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, 'Editar')
          editBtn.addEventListener('click', () => openPedidoModal(p))
          actions.appendChild(editBtn)
        }
        if (canDelete) {
          const delBtn = el('button', { class: 'btn btn-sm btn-danger-outline', type: 'button' }, 'Excluir')
          delBtn.addEventListener('click', () => confirmDelete(p))
          actions.appendChild(delBtn)
        }
        row.appendChild(actions)
      }

      tbody.appendChild(row)
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openPedidoModal(p) {
    openModal({
      title: p ? 'Editar Pedido' : 'Novo Pedido',
      size:  'lg',
      renderBody: (body, close) => renderPedidoForm(body, close, p, { clientes, fornecedores, formasPagamento }),
    })
  }

  function confirmDelete(p) {
    openConfirm({
      title:        'Excluir pedido',
      message:      `Excluir pedido de "${p.clienteNome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deletePedido(p.id); toastSuccess('Pedido excluído.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  mount(container, statsRow, toolbar, tableWrap, emptyState)
  updateStats()

  return {
    update(newPedidos) {
      pedidos = newPedidos
      updateStats()
    },
  }
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatFullDate(iso) {
  if (!iso || iso.length < 10) return iso || '—'
  const [y, m, d] = iso.split('-')
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${d} de ${months[parseInt(m, 10) - 1]} de ${y}`
}
