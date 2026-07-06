import { el, mount } from '../../shared/utils/dom.js'
import { brl, relativeTime } from '../../shared/utils/formatters.js'
import { whatsappLink, whatsappIcon } from '../../shared/utils/whatsapp.js'

const CATEGORIA_LABELS = { apple: 'Apple', android: 'Android', seminovo: 'S/N', acessorios: 'Acessórios' }
const ALL = '__all__'

export function renderBuscaList(container, ofertas) {
  const searchInput = el('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por produto, variante ou fornecedor...',
  })

  const categoriaSel  = el('select', { class: 'field-select' })
  const fornecedorSel = el('select', { class: 'field-select' })
  const filtersRow = el('div', { style: 'display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap' },
    categoriaSel, fornecedorSel)

  const countBadge = el('span', { class: 'count-badge' }, `${ofertas.length}`)
  const title = el('h2', {}, 'Busca ', countBadge)
  const toolbar = el('div', { class: 'toolbar' }, title)

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Produto'),
        el('th', {}, 'Variante'),
        el('th', {}, 'Fornecedor'),
        el('th', {}, 'Preço'),
        el('th', {}, 'Cotado'),
        el('th', { class: 'col-actions' }, 'Ação'),
      )
    ),
    tbody
  )

  const tableWrapper = el('div', { class: 'table-wrapper' }, table)
  const emptyState   = el('div', { class: 'empty-state hidden' },
    el('p', {}, '😕 Nenhuma oferta encontrada.')
  )

  mount(container, toolbar, searchInput, filtersRow, tableWrapper, emptyState)

  function renderRows(list) {
    countBadge.textContent = list.length
    tbody.replaceChildren()

    if (!list.length) {
      tableWrapper.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }

    tableWrapper.classList.remove('hidden')
    emptyState.classList.add('hidden')

    for (const o of list) {
      const produtoCell = el('td', { class: 'td-name' }, o.produtoNome || '—')

      const fornecedorCell = el('td', {}, o.fornecedorNome || '—')
      if (o.verified) {
        fornecedorCell.appendChild(el('img', {
          src: `${import.meta.env.BASE_URL}verified-badge.png`,
          class: 'verified-badge',
          title: 'Fornecedor validado',
          alt: 'Validado',
        }))
      }

      const cells = [
        produtoCell,
        el('td', {}, o.variante || '—'),
        fornecedorCell,
        el('td', {}, brl(o.preco)),
        el('td', {}, relativeTime(o.quotedAt)),
      ]

      const waLink = whatsappLink(
        o.fornecedorPhone,
        o.fornecedorPhoneCountry,
        `Olá! Vi que você tem ${o.produtoNome}${o.variante ? ' ' + o.variante : ''} por ${brl(o.preco)}, ainda tem disponível?`
      )
      const actionCell = el('td', { class: 'col-actions' })
      if (waLink) {
        actionCell.appendChild(
          el('a', { href: waLink, target: '_blank', rel: 'noopener', class: 'icon-btn', title: 'Perguntar no WhatsApp' }, whatsappIcon())
        )
      }
      cells.push(actionCell)

      tbody.appendChild(el('tr', {}, ...cells))
    }
  }

  let allOfertas = ofertas

  function refreshFilterOptions() {
    const categorias = [...new Set(allOfertas.map(o => o.categoria).filter(Boolean))].sort()
    const prevCategoria = categoriaSel.value
    categoriaSel.replaceChildren(
      el('option', { value: ALL }, 'Todas as categorias'),
      ...categorias.map(c => el('option', { value: c }, CATEGORIA_LABELS[c] || c))
    )
    categoriaSel.value = categorias.includes(prevCategoria) ? prevCategoria : ALL

    const fornecedores = [...new Set(allOfertas.map(o => o.fornecedorNome).filter(Boolean))].sort()
    const prevFornecedor = fornecedorSel.value
    fornecedorSel.replaceChildren(
      el('option', { value: ALL }, 'Todos os fornecedores'),
      ...fornecedores.map(f => el('option', { value: f }, f))
    )
    fornecedorSel.value = fornecedores.includes(prevFornecedor) ? prevFornecedor : ALL
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase()
    const categoria  = categoriaSel.value
    const fornecedor = fornecedorSel.value

    const filtered = allOfertas.filter(o => {
      if (categoria !== ALL && o.categoria !== categoria) return false
      if (fornecedor !== ALL && o.fornecedorNome !== fornecedor) return false
      if (!q) return true
      return (
        (o.produtoNomeLower || (o.produtoNome || '').toLowerCase()).includes(q) ||
        (o.variante || '').toLowerCase().includes(q) ||
        (o.fornecedorNome || '').toLowerCase().includes(q)
      )
    })
    renderRows(filtered)
  }

  refreshFilterOptions()
  applyFilters()

  searchInput.addEventListener('input', applyFilters)
  categoriaSel.addEventListener('change', applyFilters)
  fornecedorSel.addEventListener('change', applyFilters)

  return {
    update(newList) {
      allOfertas = newList
      refreshFilterOptions()
      applyFilters()
    },
  }
}
