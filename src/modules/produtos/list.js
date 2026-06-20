import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { deleteProduto } from './service.js'
import { renderProdutoForm } from './form.js'

export function renderProdutoList(container, produtos) {
  const canCreate = can('produtos', 'create')
  const canEdit   = can('produtos', 'edit')
  const canDelete = can('produtos', 'delete')

  // ── Categorias únicas para datalist ───────────────────────────────────────
  function getCategorias() {
    return [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort()
  }

  // ── Busca ─────────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'search', class: 'search-input',
    placeholder: 'Buscar por nome ou categoria...' })

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Novo Produto')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => openProdutoModal(null))

  const countBadge = el('span', { class: 'count-badge' })

  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:10px;align-items:center' }, newBtn, searchInp),
    countBadge
  )

  // ── Tabela ────────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table produtos-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Nome'),
        el('th', {}, 'Categoria'),
        el('th', { class: 'th-money' }, 'Custo'),
        el('th', { class: 'th-money' }, 'Venda'),
        el('th', { class: 'th-money' }, 'Margem'),
        el('th', {}, 'Estoque'),
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, '')] : [])
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' })

  function renderTable() {
    const q = searchInp.value.trim().toLowerCase()
    const filtered = q
      ? produtos.filter(p =>
          p.nameLower?.includes(q) || p.categoriaLower?.includes(q)
        )
      : [...produtos]

    countBadge.textContent = filtered.length

    if (!filtered.length) {
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      emptyState.replaceChildren(
        el('p', {}, q ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'),
        el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
          canCreate && !q ? 'Clique em "+ Novo Produto" para começar.' : '')
      )
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')
    tbody.replaceChildren()

    for (const p of filtered) {
      const margem = p.margemPct ?? 0
      const margemCell = el('td', { class: 'td-money' },
        el('span', { class: 'margem-pct ' + (margem >= 0 ? 'green' : 'red') },
          `${margem >= 0 ? '+' : ''}${margem.toFixed(1)}%`
        )
      )

      const estoqueCell = el('td', {})
      if (p.controlaEstoque) {
        const abaixoMinimo = p.estoqueAtual <= p.estoqueMinimo
        estoqueCell.appendChild(
          el('span', { class: 'estoque-badge ' + (abaixoMinimo ? 'estoque-baixo' : '') },
            String(p.estoqueAtual) + ' un'
          )
        )
        if (abaixoMinimo && p.estoqueMinimo > 0) {
          estoqueCell.appendChild(el('span', { class: 'estoque-min-hint' }, `mín ${p.estoqueMinimo}`))
        }
      } else {
        estoqueCell.textContent = '—'
      }

      const row = el('tr', {},
        el('td', { class: 'td-name' }, p.nome),
        el('td', {}, p.categoria || '—'),
        el('td', { class: 'td-money' }, brl(p.precoCusto)),
        el('td', { class: 'td-money' }, brl(p.precoVenda)),
        margemCell,
        estoqueCell,
      )

      if (canEdit || canDelete) {
        const actions = el('td', { class: 'td-actions' })
        if (canEdit) {
          const editBtn = el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, 'Editar')
          editBtn.addEventListener('click', () => openProdutoModal(p))
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

  searchInp.addEventListener('input', renderTable)

  function openProdutoModal(p) {
    openModal({
      title: p ? 'Editar Produto' : 'Novo Produto',
      size:  'lg',
      renderBody: (body, close) => renderProdutoForm(body, close, p, getCategorias()),
    })
  }

  function confirmDelete(p) {
    openConfirm({
      title:        'Excluir produto',
      message:      `Excluir "${p.nome}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deleteProduto(p.id); toastSuccess('Produto excluído.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  mount(container, toolbar, tableWrap, emptyState)
  renderTable()

  return {
    update(newProdutos) {
      produtos = newProdutos
      renderTable()
    }
  }
}
