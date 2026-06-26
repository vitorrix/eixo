import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { deletePedido, patchPedido, confirmarPagamento } from './service.js'
import { renderPedidoForm } from './form.js'

const STATUS_META = {
  negociando:           { label: 'Negociando',       cls: 'badge-negociando'    },
  aguardando_pagamento: { label: 'Aguard. Pgto',     cls: 'badge-aguard-pgto'   },
  pago:                 { label: 'Pago',              cls: 'badge-pago'          },
  cancelado:            { label: 'Cancelado',         cls: 'badge-cancelado'     },
}

const PAG_LABEL = { pix: '🏦 PIX', dinheiro: '💰 Dinheiro', cartao: '💳 Cartão', link: '🏪 Link' }

function monthKey(iso) { return iso ? iso.slice(0, 7) : '' }

function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function calcStats(list) {
  const total   = list.length
  const valor   = list.reduce((s, p) => s + (p.valorNegociado || p.totalVenda || 0), 0)
  const pagos   = list.filter(p => p.status === 'pago').length
  const pend    = list.filter(p => p.status === 'negociando' || p.status === 'aguardando_pagamento').length
  return { total, valor, pagos, pend }
}

function kpiCard(label, valueEl, sub) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    valueEl,
    el('div', { class: 'pedido-stat-sub' }, sub)
  )
}

export function renderPedidoList(container, pedidos, { clientes, produtosCatalogo, fornecedores }) {
  const canCreate = can('pedidos', 'create')
  const canEdit   = can('pedidos', 'edit')
  const canDelete = can('pedidos', 'delete')

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEl  = el('div', { class: 'pedido-stat-value' })
  const valorEl  = el('div', { class: 'pedido-stat-value green' })
  const pagosEl  = el('div', { class: 'pedido-stat-value green' })
  const pendEl   = el('div', { class: 'pedido-stat-value' })
  const subLabel = el('span', {})

  function updateKpis(list) {
    const s = calcStats(list)
    totalEl.textContent = s.total
    valorEl.textContent = brl(s.valor)
    pagosEl.textContent = s.pagos
    pendEl.textContent  = s.pend
    pendEl.className    = 'pedido-stat-value ' + (s.pend > 0 ? 'red' : '')
    subLabel.textContent = currentMonth ? monthLabel(currentMonth) : 'total'
  }

  let currentMonth = nowMonth()

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

  const monthNavLabel = el('span', { class: 'month-nav-label' })
  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); refresh() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); refresh() })

  const kpisRow = el('div', { class: 'pedidos-stats' },
    kpiCard('Pedidos',       totalEl, subLabel),
    kpiCard('Valor Negoc.',  valorEl, 'total'),
    kpiCard('Pagos',         pagosEl, 'confirmados'),
    kpiCard('Pendentes',     pendEl,  'negoc. + aguard.'),
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

  // ── Tabela ─────────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const colCount = (canEdit || canDelete) ? 8 : 7
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produtos'),
        el('th', { class: 'th-money' }, 'Valor'),
        el('th', {}, 'Pgto'),
        el('th', {}, 'Status'),
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
    if (q) {
      list = list.filter(p => {
        const cliente = (p.cliente || p.clienteNome || '').toLowerCase()
        const prods   = (p.produtos || []).map(pr => pr.nome || '').join(' ').toLowerCase()
        return cliente.includes(q) || prods.includes(q)
      })
    }
    return list
  }

  function refresh() {
    monthNavLabel.textContent = monthLabel(currentMonth)
    const list = filteredList()
    countBadge.textContent = list.length
    updateKpis(list)
    renderTable(list)
  }

  function renderTable(list) {
    tbody.replaceChildren()
    if (!list.length) {
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')

    for (const p of list) {
      const meta = STATUS_META[p.status] || { label: p.status || '—', cls: 'badge-negociando' }

      // Produtos cell
      const prodsCell = el('td', { class: 'td-produtos' })
      ;(p.produtos || []).forEach(pr => {
        const line = el('div', { class: 'pedido-produto-line' },
          el('span', { class: 'dot' }, '●'),
          el('span', { class: 'pedido-produto-nome' }, pr.nome || '—'),
        )
        prodsCell.appendChild(line)
        if (pr.acessorios?.length) {
          const sub = el('div', { class: 'pedido-produto-sub' })
          pr.acessorios.forEach(a => sub.appendChild(el('span', { class: 'acessorios-tag' }, a)))
          prodsCell.appendChild(sub)
        }
      })

      // Valor
      const valor = p.valorNegociado ?? p.totalVenda ?? 0

      // Ações
      const actionsCell = el('td', { class: 'td-actions' })
      if (canEdit) {
        const editBtn = el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, 'Editar')
        editBtn.addEventListener('click', () => openPedidoModal(p))
        actionsCell.appendChild(editBtn)
      }

      if (canEdit && p.status === 'negociando') {
        const moveBtn = el('button', { class: 'btn btn-sm btn-outline-blue', type: 'button' }, '→ Aguardar Pgto')
        moveBtn.addEventListener('click', () => advanceStatus(p, 'aguardando_pagamento'))
        actionsCell.appendChild(moveBtn)
      }

      if (canEdit && p.status === 'aguardando_pagamento') {
        const confBtn = el('button', { class: 'btn btn-sm btn-success', type: 'button' }, '✓ Confirmar Pgto')
        confBtn.addEventListener('click', () => openConfirmarModal(p))
        actionsCell.appendChild(confBtn)
      }

      if (canEdit && (p.status === 'negociando' || p.status === 'aguardando_pagamento')) {
        const cancelBtn = el('button', { class: 'btn btn-sm btn-danger-outline', type: 'button' }, 'Cancelar')
        cancelBtn.addEventListener('click', () => advanceStatus(p, 'cancelado'))
        actionsCell.appendChild(cancelBtn)
      }

      if (canDelete && (p.status === 'cancelado')) {
        const delBtn = el('button', { class: 'btn btn-sm btn-danger-outline', type: 'button' }, 'Excluir')
        delBtn.addEventListener('click', () => confirmDelete(p))
        actionsCell.appendChild(delBtn)
      }

      const row = el('tr', {},
        el('td', { class: 'td-date' }, shortDate(p.dataContato || p.data || '')),
        el('td', { class: 'td-name' }, p.cliente || p.clienteNome || '—'),
        prodsCell,
        el('td', { class: 'td-money' }, brl(valor)),
        el('td', {}, p.formaPagamento ? (PAG_LABEL[p.formaPagamento] || p.formaPagamento) : '—'),
        el('td', {}, el('span', { class: `status-badge ${meta.cls}` }, meta.label)),
        ...(canEdit || canDelete ? [actionsCell] : []),
      )
      tbody.appendChild(row)
    }
  }

  // ── Modais ─────────────────────────────────────────────────────────────────
  function openPedidoModal(p) {
    openModal({
      title:      p ? 'Editar Pedido' : 'Novo Pedido',
      size:       'lg',
      renderBody: (body, close) =>
        renderPedidoForm(body, close, p, { clientes, produtosCatalogo, fornecedores }),
    })
  }

  function openConfirmarModal(pedido) {
    openModal({
      title: 'Confirmar Pagamento',
      size:  'md',
      renderBody: (body, close) => {
        const fornInp  = el('input', { type: 'text', list: 'cf-forn-list', placeholder: 'ex: Mohamed, XFB...' })
        const custoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
        const dl = el('datalist', { id: 'cf-forn-list' })
        fornecedores.forEach(f => dl.appendChild(el('option', { value: f.name })))

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', close)

        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Confirmar e gerar Compra + Venda')
        okBtn.addEventListener('click', async () => {
          if (!fornInp.value.trim()) { toastError('Informe o fornecedor.'); return }
          if (!custoInp.value) { toastError('Informe o custo de compra.'); return }
          okBtn.disabled = true; okBtn.textContent = 'Processando...'
          try {
            await confirmarPagamento(pedido, { fornecedor: fornInp.value, custo: custoInp.value })
            toastSuccess('Pagamento confirmado — Compra e Venda gerados.')
            close()
          } catch (err) {
            console.error(err)
            toastError('Erro ao confirmar pagamento.')
            okBtn.disabled = false; okBtn.textContent = 'Confirmar e gerar Compra + Venda'
          }
        })

        mount(body,
          dl,
          el('p', { class: 'confirm-message', style: 'margin-bottom:16px' },
            `Confirmar pagamento do pedido de "${pedido.cliente || pedido.clienteNome || '?'}"?`,
          ),
          el('p', { class: 'confirm-message', style: 'margin-bottom:20px;font-size:12px' },
            'Isso criará um registro em Compras e um em Vendas automaticamente.'
          ),
          el('div', { class: 'form-grid' },
            el('div', { class: 'field' }, el('label', {}, 'Fornecedor'), fornInp),
            el('div', { class: 'field' }, el('label', {}, 'Custo de compra R$'), custoInp),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      },
    })
  }

  async function advanceStatus(p, status) {
    try {
      await patchPedido(p.id, { status })
      toastSuccess(`Pedido ${status === 'cancelado' ? 'cancelado' : 'atualizado'}.`)
    } catch {
      toastError('Erro ao atualizar status.')
    }
  }

  function confirmDelete(p) {
    openConfirm({
      title:        'Excluir pedido',
      message:      `Excluir pedido de "${p.cliente || p.clienteNome}"? Não pode ser desfeito.`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deletePedido(p.id); toastSuccess('Pedido excluído.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  mount(container, kpisRow, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return {
    update(newPedidos) { pedidos = newPedidos; refresh() },
  }
}
