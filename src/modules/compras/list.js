import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { createCompra, patchCompra, atualizarStatusCompra, updateCompra, deleteCompra } from './service.js'

const STATUS_META = {
  pendente:        { label: 'Pendente',         cls: 'badge-pendente'  },
  comprado:        { label: 'Comprado',         cls: 'badge-comprado'  },
  recebido:        { label: 'Recebido',         cls: 'badge-recebido'  },
  orcamento:       { label: 'Orçamento',        cls: 'badge-orcamento' },
  compra_realizada:{ label: 'Compra Realizada', cls: 'badge-realizada' },
}

// "Orçamento" e "Compra Realizada" são pra aparelho recebido em troca (forma de
// pagamento): entra em estoque como orçamento (valor ainda não definido pra
// revenda); quando anunciado/pronto pra vender, vira "Compra Realizada".
const STATUS_ORDER = ['pendente', 'comprado', 'recebido', 'orcamento', 'compra_realizada']

function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthKey(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function renderComprasList(container, compras, { fornecedores, produtosCatalogo }) {
  const canCreate = can('compras', 'create')
  const canEdit   = can('compras', 'edit')
  const canDelete = can('compras', 'delete')

  let currentMonth = nowMonth()

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEl    = el('div', { class: 'pedido-stat-value' })
  const custoEl    = el('div', { class: 'pedido-stat-value' })
  const pendEl     = el('div', { class: 'pedido-stat-value red' })
  const recebidoEl = el('div', { class: 'pedido-stat-value green' })

  function updateKpis(list) {
    totalEl.textContent    = list.length
    custoEl.textContent    = brl(list.reduce((s, c) => s + (c.custo || 0), 0))
    pendEl.textContent     = list.filter(c => c.status === 'pendente').length
    recebidoEl.textContent = list.filter(c => c.status === 'recebido').length
    pendEl.className       = 'pedido-stat-value ' + (pendEl.textContent > 0 ? 'red' : 'green')
  }

  function kpiCard(label, valueEl, sub) {
    return el('div', { class: 'pedido-stat' },
      el('div', { class: 'pedido-stat-label' }, label),
      valueEl,
      el('div', { class: 'pedido-stat-sub' }, sub)
    )
  }

  const kpisRow = el('div', { class: 'pedidos-stats' },
    kpiCard('Compras',    totalEl,    'no mês'),
    kpiCard('Custo Total', custoEl,    'soma do mês'),
    kpiCard('Pendentes',  pendEl,     'a comprar'),
    kpiCard('Recebidos',  recebidoEl, 'em mãos'),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input',
    placeholder: 'Buscar por produto, fornecedor ou cliente...' })
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

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Nova Compra')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => abrirNovaCompraModal())

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
        el('th', {}, 'Fornecedor'),
        el('th', { class: 'th-money' }, 'Custo'),
        el('th', {}, 'Status'),
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, '')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhuma compra neste mês.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      'As compras são geradas ao confirmar o pagamento de um pedido.')
  )

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = compras.filter(c => monthKey(c.criadoEm) === currentMonth)
    if (q) list = list.filter(c =>
      (c.produto || '').toLowerCase().includes(q) ||
      (c.fornecedor || '').toLowerCase().includes(q) ||
      (c.cliente || '').toLowerCase().includes(q)
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

    for (const c of list) {
      const meta = STATUS_META[c.status] || { label: c.status, cls: 'badge-pendente' }

      // Inline status select
      const statusSel = el('select', { class: `status-inline-sel ${meta.cls}` })
      STATUS_ORDER.forEach(s => {
        const opt = el('option', { value: s }, STATUS_META[s]?.label || s)
        if (s === c.status) opt.selected = true
        statusSel.appendChild(opt)
      })
      statusSel.addEventListener('change', async () => {
        const prev = statusSel.className
        statusSel.className = `status-inline-sel ${STATUS_META[statusSel.value]?.cls || ''}`
        try {
          await atualizarStatusCompra(c, statusSel.value)
          toastSuccess(
            ['recebido', 'orcamento'].includes(statusSel.value) && !c.pedidoId && c.produtoId
              ? 'Status atualizado. Estoque atualizado.'
              : 'Status atualizado.'
          )
        } catch {
          toastError('Erro ao atualizar.')
          statusSel.value = c.status
          statusSel.className = prev
        }
      })

      // Ações
      const actionsCell = el('td', { class: 'col-actions' }, renderRowActions({
        canEdit, canDelete,
        onEdit: () => openEditModal(c),
        onDelete: () => confirmDelete(c),
      }))

      const dateStr = c.criadoEm?.toDate ? shortDate(c.criadoEm.toDate().toISOString().slice(0,10)) : '—'

      const row = el('tr', {},
        el('td', { class: 'td-date' }, dateStr),
        el('td', {}, c.cliente || '—'),
        el('td', { class: 'td-name' }, c.produto || '—'),
        el('td', {}, c.fornecedor || '—'),
        el('td', { class: 'td-money' }, brl(c.custo || 0)),
        el('td', {}, statusSel),
        ...(canEdit || canDelete ? [actionsCell] : []),
      )
      tbody.appendChild(row)
    }
  }

  function abrirNovaCompraModal() {
    const produtoNomes = produtosCatalogo.map(p => p.nome)

    openModal({
      title: 'Nova Compra',
      size:  'md',
      renderBody: (body, closeModal) => {
        let produtoId = null

        const produtoAc = createAutocomplete({
          placeholder: 'Produto do catálogo',
          items:       produtoNomes,
          onSelect:    v => { produtoId = produtosCatalogo.find(p => p.nome === v)?.id || null },
        })
        produtoAc.el.style.width = '100%'
        produtoAc.el.addEventListener('input', () => {
          produtoId = produtosCatalogo.find(p => p.nome === produtoAc.getValue())?.id || null
        })

        const fornAc = createAutocomplete({
          placeholder: 'Fornecedor',
          items:       fornecedores.map(f => f.box ? `${f.name} - ${f.box}` : f.name),
        })
        fornAc.el.style.width = '100%'

        const custoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })

        const statusSelNew = el('select', {})
        STATUS_ORDER.forEach(s => statusSelNew.appendChild(el('option', { value: s }, STATUS_META[s]?.label || s)))

        const aparelhoInp = el('textarea', { rows: '3', class: 'field-textarea',
          placeholder: 'Specs, serial, IMEI... (se já souber — aparece no recibo do cliente)' })

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', closeModal)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Criar compra')
        okBtn.addEventListener('click', async () => {
          const produto = produtoAc.getValue().trim()
          if (!produto) { toastError('Selecione o produto.'); return }
          okBtn.disabled = true
          try {
            await createCompra({
              produtoId, produto,
              fornecedor:  fornAc.getValue(),
              custo:       custoInp.value,
              status:      statusSelNew.value,
              observacoes: aparelhoInp.value,
            })
            toastSuccess('Compra criada.'); closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao criar compra.')
            okBtn.disabled = false
          }
        })

        mount(body,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Produto'), produtoAc.el),
            el('div', { class: 'field field-full' }, el('label', {}, 'Fornecedor'), fornAc.el),
            el('div', { class: 'field' }, el('label', {}, 'Custo R$'), custoInp),
            el('div', { class: 'field' }, el('label', {}, 'Status'), statusSelNew),
            el('div', { class: 'field field-full' }, el('label', {}, 'Dados do aparelho'), aparelhoInp),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      },
    })
  }

  function openEditModal(compra) {
    openModal({
      title: 'Editar Compra',
      size:  'md',
      renderBody: (body, close) => {
        const dl = el('datalist', { id: 'ce-forn-list' })
        fornecedores.forEach(f => dl.appendChild(el('option', { value: f.name })))

        const fornInp  = el('input', { type: 'text', list: 'ce-forn-list', placeholder: 'Fornecedor' })
        const custoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
        fornInp.value  = compra.fornecedor || ''
        custoInp.value = compra.custo || ''

        const aparelhoInp = el('textarea', { rows: '3', class: 'field-textarea',
          placeholder: 'Specs, serial, IMEI... (aparece no recibo do cliente)' })
        aparelhoInp.value = compra.observacoes || ''

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', close)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')
        okBtn.addEventListener('click', async () => {
          okBtn.disabled = true
          try {
            await updateCompra(compra.id, { fornecedor: fornInp.value, custo: custoInp.value, observacoes: aparelhoInp.value })
            toastSuccess('Compra atualizada.'); close()
          } catch {
            toastError('Erro ao salvar.')
            okBtn.disabled = false
          }
        })

        mount(body,
          dl,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Fornecedor'), fornInp),
            el('div', { class: 'field' }, el('label', {}, 'Custo R$'), custoInp),
            el('div', { class: 'field field-full' }, el('label', {}, 'Dados do aparelho'), aparelhoInp),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      },
    })
  }

  function confirmDelete(c) {
    openConfirm({
      title:        'Excluir compra',
      message:      `Excluir compra de "${c.produto}"?`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deleteCompra(c.id); toastSuccess('Compra excluída.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  mount(container, kpisRow, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return {
    update(newCompras) { compras = newCompras; refresh() },
  }
}
