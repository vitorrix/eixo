import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal } from '../../shared/components/Modal.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { createVenda, patchVenda } from './service.js'

const ENTREGA_META = {
  aguardando: { label: 'Aguardando',    cls: 'badge-negociando'  },
  retirada:   { label: '🏠 Retirada',   cls: 'badge-comprado'    },
  motoboy:    { label: '🏍️ Motoboy',    cls: 'badge-comprado'    },
  correio:    { label: '✈️ Correio',     cls: 'badge-comprado'    },
  entregue:   { label: '✅ Entregue',    cls: 'badge-recebido'    },
}

const ENTREGA_ORDER = ['aguardando', 'retirada', 'motoboy', 'correio', 'entregue']

const PAG_LABEL = { pix: '🏦 PIX', dinheiro: '💰 Dinheiro', cartao: '💳 Cartão', link: '🏪 Link' }

function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthKey(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function renderVendasList(container, vendas, { produtosCatalogo, clientes } = {}) {
  const canCreate = can('vendas', 'create')
  const canEdit   = can('vendas', 'edit')

  let currentMonth = nowMonth()

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEl   = el('div', { class: 'pedido-stat-value' })
  const fatEl     = el('div', { class: 'pedido-stat-value green' })
  const ticketEl  = el('div', { class: 'pedido-stat-value' })
  const pendEl    = el('div', { class: 'pedido-stat-value' })

  function updateKpis(list) {
    const fat  = list.reduce((s, v) => s + (v.valorVenda || 0), 0)
    const pend = list.filter(v => v.statusEntrega !== 'entregue').length
    totalEl.textContent  = list.length
    fatEl.textContent    = brl(fat)
    ticketEl.textContent = list.length ? brl(Math.round(fat / list.length)) : brl(0)
    pendEl.textContent   = pend
    pendEl.className     = 'pedido-stat-value ' + (pend > 0 ? 'red' : '')
  }

  function kpiCard(label, valueEl, sub) {
    return el('div', { class: 'pedido-stat' },
      el('div', { class: 'pedido-stat-label' }, label),
      valueEl,
      el('div', { class: 'pedido-stat-sub' }, sub)
    )
  }

  const kpisRow = el('div', { class: 'pedidos-stats' },
    kpiCard('Vendas',       totalEl,  'no mês'),
    kpiCard('Faturamento',  fatEl,    'receita'),
    kpiCard('Ticket Médio', ticketEl, 'por venda'),
    kpiCard('Pendentes',    pendEl,   'não entregues'),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input',
    placeholder: 'Buscar por cliente ou produto...' })
  searchInp.addEventListener('input', () => refresh())

  const monthNavLabel = el('span', { class: 'month-nav-label' })
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

  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); refresh() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); refresh() })

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Nova Venda')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => abrirNovaVendaModal())

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
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produto'),
        el('th', { class: 'th-money' }, 'Valor'),
        el('th', {}, 'Pgto'),
        el('th', {}, 'Entrega'),
        el('th', {}, 'Recibo'),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhuma venda neste mês.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      'As vendas são geradas ao confirmar o pagamento de um pedido.')
  )

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = vendas.filter(v => monthKey(v.criadoEm) === currentMonth)
    if (q) list = list.filter(v =>
      (v.cliente || '').toLowerCase().includes(q) ||
      (v.produto || '').toLowerCase().includes(q)
    )
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

    for (const v of list) {
      const entregaMeta = ENTREGA_META[v.statusEntrega] || ENTREGA_META.aguardando

      // Inline entrega select
      const entregaSel = el('select', { class: `status-inline-sel ${entregaMeta.cls}` })
      ENTREGA_ORDER.forEach(s => {
        const opt = el('option', { value: s }, ENTREGA_META[s]?.label || s)
        if (s === v.statusEntrega) opt.selected = true
        entregaSel.appendChild(opt)
      })
      // Venda vinda de pedido: entrega obedece a logística do pedido, não é editável aqui.
      if (!canEdit || v.pedidoId) entregaSel.disabled = true
      if (v.pedidoId) entregaSel.title = 'Segue a logística do pedido'
      entregaSel.addEventListener('change', async () => {
        const prev = entregaSel.className
        entregaSel.className = `status-inline-sel ${ENTREGA_META[entregaSel.value]?.cls || ''}`
        try {
          await patchVenda(v.id, { statusEntrega: entregaSel.value })
          toastSuccess('Entrega atualizada.')
        } catch {
          toastError('Erro ao atualizar.')
          entregaSel.value = v.statusEntrega
          entregaSel.className = prev
        }
      })

      // Recibo toggle
      const reciboChk = el('input', { type: 'checkbox', class: 'recibo-chk' })
      reciboChk.checked = !!v.reciboEmitido
      if (!canEdit) reciboChk.disabled = true
      const reciboLabel = el('label', { class: 'recibo-label' },
        reciboChk,
        el('span', {}, v.reciboEmitido ? 'Emitido' : 'Pendente')
      )
      reciboChk.addEventListener('change', async () => {
        try {
          await patchVenda(v.id, { reciboEmitido: reciboChk.checked })
          reciboLabel.querySelector('span').textContent = reciboChk.checked ? 'Emitido' : 'Pendente'
          toastSuccess(reciboChk.checked ? 'Recibo emitido.' : 'Recibo desmarcado.')
        } catch {
          toastError('Erro ao atualizar recibo.')
          reciboChk.checked = !reciboChk.checked
        }
      })

      const dateStr = v.criadoEm?.toDate ? shortDate(v.criadoEm.toDate().toISOString().slice(0,10)) : '—'
      const pagLabel = PAG_LABEL[v.formaPagamento] || v.formaPagamento || '—'

      const row = el('tr', {},
        el('td', { class: 'td-date' }, dateStr),
        el('td', { class: 'td-name' }, v.cliente || '—'),
        el('td', {}, v.produto || '—'),
        el('td', { class: 'td-money' }, brl(v.valorVenda || 0)),
        el('td', {}, pagLabel),
        el('td', {}, entregaSel),
        el('td', {}, reciboLabel),
      )
      tbody.appendChild(row)
    }
  }

  function abrirNovaVendaModal() {
    const produtoNomes  = (produtosCatalogo || []).map(p => p.nome)
    const clienteNomes  = (clientes || []).map(c => c.name)

    openModal({
      title: 'Nova Venda',
      size:  'md',
      renderBody: (body, closeModal) => {
        let produtoId = null

        const produtoAc = createAutocomplete({
          placeholder: 'Produto do catálogo',
          items:       produtoNomes,
          onSelect:    v => { produtoId = (produtosCatalogo || []).find(p => p.nome === v)?.id || null },
        })
        produtoAc.el.style.width = '100%'
        produtoAc.el.addEventListener('input', () => {
          produtoId = (produtosCatalogo || []).find(p => p.nome === produtoAc.getValue())?.id || null
        })

        const clienteAc = createAutocomplete({
          placeholder: 'Nome do cliente',
          items:       clienteNomes,
        })
        clienteAc.el.style.width = '100%'

        const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })

        const pagSel = el('select', {})
        Object.entries(PAG_LABEL).forEach(([value, label]) => pagSel.appendChild(el('option', { value }, label)))

        const entregaSelNew = el('select', {})
        ENTREGA_ORDER.forEach(s => entregaSelNew.appendChild(el('option', { value: s }, ENTREGA_META[s]?.label || s)))

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', closeModal)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Criar venda')
        okBtn.addEventListener('click', async () => {
          const produto = produtoAc.getValue().trim()
          if (!produto) { toastError('Selecione o produto.'); return }
          okBtn.disabled = true
          try {
            await createVenda({
              produtoId, produto,
              cliente:        clienteAc.getValue(),
              valorVenda:     valorInp.value,
              formaPagamento: pagSel.value,
              statusEntrega:  entregaSelNew.value,
            })
            toastSuccess('Venda criada.'); closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao criar venda.')
            okBtn.disabled = false
          }
        })

        mount(body,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Produto'), produtoAc.el),
            el('div', { class: 'field field-full' }, el('label', {}, 'Cliente'), clienteAc.el),
            el('div', { class: 'field' }, el('label', {}, 'Valor R$'), valorInp),
            el('div', { class: 'field' }, el('label', {}, 'Forma de pagamento'), pagSel),
            el('div', { class: 'field' }, el('label', {}, 'Entrega'), entregaSelNew),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      },
    })
  }

  mount(container, kpisRow, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return {
    update(newVendas) { vendas = newVendas; refresh() },
  }
}
