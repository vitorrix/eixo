import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { brl, relativeTime } from '../../shared/utils/formatters.js'
import { whatsappLink, whatsappIcon } from '../../shared/utils/whatsapp.js'

const CATEGORIA_PILLS = [
  { key: 'apple', label: 'Apple', emoji: '🍎' },
  { key: 'android', label: 'Android', emoji: '🤖' },
  { key: 'seminovo', label: 'Semi-novo', emoji: '♻️' },
  { key: 'acessorios', label: 'Acessórios', emoji: '🔧' },
]
const ALL = '__all__'

function filterIcon(key) {
  const paths = {
    capacidade: ['M4 7l8-4 8 4-8 4-8-4z', 'M4 7v10l8 4 8-4V7', 'M12 11v10'],
    cor: ['M12 2a10 10 0 000 20c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 16 15 16h2a4 4 0 004-4c0-5.5-4.5-10-9-10z', 'M7 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', 'M11 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', 'M16 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z'],
    fornecedor: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
  }
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '13', height: '13',
  })
  for (const d of paths[key]) svg.appendChild(svgEl('path', { d }))
  return svg
}

function splitVariante(variante) {
  if (!variante) return { capacidade: '', cor: '' }
  const match = variante.match(/^(\d+\s?(?:GB|TB))\s*(.*)$/i)
  if (match) return { capacidade: match[1].replace(/\s+/g, '').toUpperCase(), cor: match[2].trim() }
  return { capacidade: '', cor: variante.trim() }
}

function filterGroup(labelText, iconKey, selectEl) {
  return el('div', { class: 'busca-filter-group' },
    el('span', { class: 'busca-filter-label' }, filterIcon(iconKey), labelText),
    selectEl
  )
}

export function renderBuscaList(container, ofertas) {
  const searchInput = el('input', {
    type: 'search',
    class: 'busca-search-input',
    placeholder: 'Buscar por produto, variante ou fornecedor... ex: iPhone 17 Pro Max',
  })

  let categoriaAtiva = ALL
  const pillButtons = {}
  const pillsRow = el('div', { class: 'busca-pills-row' })
  for (const { key, label, emoji } of CATEGORIA_PILLS) {
    const btn = el('button', { type: 'button', class: 'busca-pill' }, `${emoji} ${label}`)
    btn.addEventListener('click', () => {
      categoriaAtiva = categoriaAtiva === key ? ALL : key
      updatePillStates()
      applyFilters()
    })
    pillButtons[key] = btn
    pillsRow.appendChild(btn)
  }
  function updatePillStates() {
    for (const [key, btn] of Object.entries(pillButtons)) {
      btn.classList.toggle('active', categoriaAtiva === key)
    }
  }

  const capacidadeSel = el('select', { class: 'field-select' })
  const corSel        = el('select', { class: 'field-select' })
  const fornecedorSel = el('select', { class: 'field-select' })
  const filtersRow = el('div', { class: 'busca-filters-row' },
    filterGroup('Capacidade', 'capacidade', capacidadeSel),
    filterGroup('Cor', 'cor', corSel),
    filterGroup('Fornecedor', 'fornecedor', fornecedorSel),
  )

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

  mount(container, toolbar, searchInput, pillsRow, filtersRow, tableWrapper, emptyState)

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
    const variantes = allOfertas.map(o => splitVariante(o.variante))

    const capacidades = [...new Set(variantes.map(v => v.capacidade).filter(Boolean))]
      .sort((a, b) => parseInt(a) - parseInt(b))
    const prevCapacidade = capacidadeSel.value
    capacidadeSel.replaceChildren(
      el('option', { value: ALL }, 'Todas as capacidades'),
      ...capacidades.map(c => el('option', { value: c }, c))
    )
    capacidadeSel.value = capacidades.includes(prevCapacidade) ? prevCapacidade : ALL

    const cores = [...new Set(variantes.map(v => v.cor).filter(Boolean))].sort()
    const prevCor = corSel.value
    corSel.replaceChildren(
      el('option', { value: ALL }, 'Todas as cores'),
      ...cores.map(c => el('option', { value: c }, c))
    )
    corSel.value = cores.includes(prevCor) ? prevCor : ALL

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
    const capacidade = capacidadeSel.value
    const cor        = corSel.value
    const fornecedor = fornecedorSel.value

    const filtered = allOfertas.filter(o => {
      if (categoriaAtiva !== ALL && o.categoria !== categoriaAtiva) return false
      const v = splitVariante(o.variante)
      if (capacidade !== ALL && v.capacidade !== capacidade) return false
      if (cor !== ALL && v.cor !== cor) return false
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
  capacidadeSel.addEventListener('change', applyFilters)
  corSel.addEventListener('change', applyFilters)
  fornecedorSel.addEventListener('change', applyFilters)

  return {
    update(newList) {
      allOfertas = newList
      refreshFilterOptions()
      applyFilters()
    },
  }
}
