import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { brl, relativeTime } from '../../shared/utils/formatters.js'
import { whatsappLink, whatsappIcon } from '../../shared/utils/whatsapp.js'
import { createMultiSelect } from '../../shared/components/MultiSelect.js'

const CATEGORIA_PILLS = [
  { key: 'apple', label: 'Apple', emoji: '🍎' },
  { key: 'android', label: 'Android', emoji: '🤖' },
  { key: 'seminovo', label: 'Semi-novo', emoji: '♻️' },
  { key: 'acessorios', label: 'Acessórios', emoji: '🔧' },
]
const ALL = '__all__'

function toDate(timestamp) {
  if (!timestamp) return null
  return typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp)
}

function toDateInputValue(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Retorna a data (YYYY-MM-DD) da oferta mais recente — usada como valor padrão do filtro,
// pra já abrir mostrando a última lista recebida (hoje, ou ontem se ainda não veio nada hoje).
function mostRecentDateValue(list) {
  let maisRecente = null
  for (const o of list) {
    const d = toDate(o.quotedAt)
    if (d && (!maisRecente || d > maisRecente)) maisRecente = d
  }
  return maisRecente ? toDateInputValue(maisRecente) : ''
}

function filterIcon(key) {
  const paths = {
    capacidade: ['M4 7l8-4 8 4-8 4-8-4z', 'M4 7v10l8 4 8-4V7', 'M12 11v10'],
    ram: ['M4 4h16v16H4z', 'M9 4v4', 'M15 4v4', 'M9 16v4', 'M15 16v4', 'M4 9h4', 'M4 15h4', 'M16 9h4', 'M16 15h4'],
    tamanho: ['M3 16l5-5', 'M8 11l2 2', 'M12 7l2 2', 'M16 3l5 5-13 13-5-5z'],
    cor: ['M12 2a10 10 0 000 20c1.5 0 2-1 2-2s-.5-1.5-.5-2.5S14 16 15 16h2a4 4 0 004-4c0-5.5-4.5-10-9-10z', 'M7 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', 'M11 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', 'M16 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z'],
    fornecedor: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10'],
    data: ['M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2z', 'M16 3v4', 'M8 3v4', 'M4 10h16'],
  }
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '13', height: '13',
  })
  for (const d of paths[key]) svg.appendChild(svgEl('path', { d }))
  return svg
}

// origem/mercado de procedência do aparelho (ver whatsapp-bot/src/aiParser.js), campo
// próprio da oferta. Mapeia pro nome canônico + bandeira do país pra exibir numa coluna
// própria, já que "Americano"/"Indiano"/etc NÃO são cores.
const ORIGEM_INFO = {
  'americano': { label: 'Americano', flag: '🇺🇸' },
  'japones':   { label: 'Japonês',   flag: '🇯🇵' },
  'indiano':   { label: 'Indiano',   flag: '🇮🇳' },
  'arabe':     { label: 'Árabe',     flag: '🇦🇪' },
  'chines':    { label: 'Chinês',    flag: '🇨🇳' },
  'europeu':   { label: 'Europeu',   flag: '🇪🇺' },
}

function stripAccents(str) {
  return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function origemFlag(origem) {
  const info = ORIGEM_INFO[stripAccents(origem).toLowerCase()]
  return info ? info.flag : ''
}

function produtoIconFile(produtoNome) {
  const n = (produtoNome || '').toLowerCase()
  if (n.includes('watch')) return 'icon-watch.png'
  if (n.includes('ipad') || n.includes('tablet')) return 'icon-tablet.png'
  if (n.includes('iphone') || n.includes('galaxy') || n.includes('phone') || n.includes('celular')) return 'icon-phone.png'
  return 'icon-acessorio.png'
}

function fornecedorAvatar(nome, fotoUrl) {
  if (fotoUrl) {
    const img = el('img', { src: fotoUrl, class: 'busca-fornecedor-avatar', alt: '' })
    img.addEventListener('error', () => img.replaceWith(fallbackAvatar(nome)), { once: true })
    return img
  }
  return fallbackAvatar(nome)
}

function fallbackAvatar(nome) {
  const letter = (nome || '?').trim().charAt(0).toUpperCase() || '?'
  return el('div', { class: 'busca-fornecedor-avatar busca-fornecedor-avatar-fallback' }, letter)
}

function filterGroup(labelText, iconKey, widgetEl) {
  return el('div', { class: 'busca-filter-group' },
    el('span', { class: 'busca-filter-label' }, filterIcon(iconKey), labelText),
    widgetEl
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
      resetPageAndApply()
    })
    pillButtons[key] = btn
    pillsRow.appendChild(btn)
  }
  function updatePillStates() {
    for (const [key, btn] of Object.entries(pillButtons)) {
      btn.classList.toggle('active', categoriaAtiva === key)
    }
  }

  const capacidadeMs = createMultiSelect({ label: 'Capacidade', allLabel: 'Todas as capacidades', onChange: () => resetPageAndApply() })
  const ramMs        = createMultiSelect({ label: 'Memória RAM', allLabel: 'Todas as memórias', onChange: () => resetPageAndApply() })
  const tamanhoMs    = createMultiSelect({ label: 'Tamanho', allLabel: 'Todos os tamanhos', onChange: () => resetPageAndApply() })
  const corMs        = createMultiSelect({ label: 'Cor', allLabel: 'Todas as cores', onChange: () => resetPageAndApply() })
  const fornecedorMs = createMultiSelect({ label: 'Fornecedor', allLabel: 'Todos os fornecedores', onChange: () => resetPageAndApply() })

  const dataInput = el('input', { type: 'date', class: 'field-select', value: mostRecentDateValue(ofertas) })
  dataInput.addEventListener('change', resetPageAndApply)

  function resetPageAndApply() {
    currentPage = 1
    applyFilters()
  }

  const filtersRow = el('div', { class: 'busca-filters-row' },
    filterGroup('Data', 'data', dataInput),
    filterGroup('Capacidade', 'capacidade', capacidadeMs.el),
    filterGroup('Memória RAM', 'ram', ramMs.el),
    filterGroup('Tamanho', 'tamanho', tamanhoMs.el),
    filterGroup('Cor', 'cor', corMs.el),
    filterGroup('Fornecedor', 'fornecedor', fornecedorMs.el),
  )

  const countBadge = el('span', { class: 'count-badge' }, `${ofertas.length}`)
  const title = el('h2', {}, 'Busca ', countBadge)
  const toolbar = el('div', { class: 'toolbar' }, title)

  const PAGE_SIZE_OPTIONS = [20, 50, 75, 100]
  let pageSize = PAGE_SIZE_OPTIONS[0]
  let currentPage = 1

  const pageSizeSelect = el('select', { class: 'field-select busca-page-size' },
    ...PAGE_SIZE_OPTIONS.map(n => el('option', { value: n }, `${n} por página`))
  )
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value)
    currentPage = 1
    applyFilters()
  })

  const pageInfo = el('span', { class: 'busca-page-info' })
  const prevBtn = el('button', { type: 'button', class: 'btn-link' }, '‹ Anterior')
  const nextBtn = el('button', { type: 'button', class: 'btn-link' }, 'Próxima ›')
  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; applyFilters() }
  })
  nextBtn.addEventListener('click', () => {
    currentPage++; applyFilters()
  })
  const paginationRow = el('div', { class: 'busca-pagination' }, pageSizeSelect, pageInfo, prevBtn, nextBtn)

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table busca-table' },
    el('thead', {},
      el('tr', {},
        el('th', { class: 'busca-col-produto' }, 'Produto'),
        el('th', { class: 'busca-col-capacidade' }, 'Capacidade'),
        el('th', { class: 'busca-col-ram' }, 'RAM'),
        el('th', { class: 'busca-col-tamanho' }, 'Tamanho'),
        el('th', { class: 'busca-col-origem' }, 'Origem'),
        el('th', { class: 'busca-col-cor' }, 'Cor'),
        el('th', { class: 'busca-col-fornecedor' }, 'Fornecedor'),
        el('th', { class: 'busca-col-preco' }, 'Preço'),
      )
    ),
    tbody
  )

  const tableWrapper = el('div', { class: 'table-wrapper' }, table)
  const emptyState   = el('div', { class: 'empty-state hidden' },
    el('p', {}, '😕 Nenhuma oferta encontrada.')
  )

  mount(container, toolbar, searchInput, pillsRow, filtersRow, tableWrapper, emptyState, paginationRow)

  function renderRows(list) {
    countBadge.textContent = list.length

    const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
    if (currentPage > totalPages) currentPage = totalPages
    if (currentPage < 1) currentPage = 1
    const pageSlice = list.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    pageInfo.textContent = list.length ? `Página ${currentPage} de ${totalPages}` : ''
    prevBtn.disabled = currentPage <= 1
    nextBtn.disabled = currentPage >= totalPages
    paginationRow.classList.toggle('hidden', list.length === 0)

    tbody.replaceChildren()

    if (!list.length) {
      tableWrapper.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }

    tableWrapper.classList.remove('hidden')
    emptyState.classList.add('hidden')

    for (const o of pageSlice) {
      const { capacidade, ram, tamanho, origem, cor } = o
      const produtoCell = el('td', { class: 'td-name' },
        el('div', { class: 'busca-produto-cell' },
          el('img', {
            src: `${import.meta.env.BASE_URL}${produtoIconFile(o.produtoNome)}`,
            class: 'busca-produto-icon',
            alt: '',
          }),
          el('span', {}, o.produtoNome || '—'),
        )
      )

      const nomeRow = el('div', { class: 'busca-fornecedor-nome' }, o.fornecedorNome || '—')
      if (o.verified) {
        nomeRow.appendChild(el('img', {
          src: `${import.meta.env.BASE_URL}verified-badge.png`,
          class: 'verified-badge',
          title: 'Fornecedor validado',
          alt: 'Validado',
        }))
      }
      const waLink = whatsappLink(
        o.fornecedorPhone,
        o.fornecedorPhoneCountry,
        `Olá! Vi que você tem ${o.produtoNome}${o.variante ? ' ' + o.variante : ''} por ${brl(o.preco)}, ainda tem disponível?`
      )
      if (waLink) {
        nomeRow.appendChild(
          el('a', { href: waLink, target: '_blank', rel: 'noopener', class: 'whatsapp-link', title: 'Perguntar no WhatsApp' }, whatsappIcon())
        )
      }

      const fornecedorInfo = el('div', {}, nomeRow)
      if (o.box) fornecedorInfo.appendChild(el('div', { class: 'busca-fornecedor-box' }, o.box))

      const fornecedorCell = el('td', {},
        el('div', { class: 'busca-fornecedor-cell' },
          fornecedorAvatar(o.fornecedorNome, o.fornecedorFotoUrl),
          fornecedorInfo,
        )
      )

      const precoCell = el('td', {},
        el('div', { class: 'busca-preco-cell' },
          el('span', { class: 'busca-preco-valor' }, brl(o.preco)),
          el('span', { class: 'busca-preco-cotado' }, relativeTime(o.quotedAt)),
        )
      )

      const origemCell = origem
        ? el('td', { class: 'busca-origem-cell', title: origem }, origemFlag(origem) || origem)
        : el('td', {}, '—')

      const cells = [
        produtoCell,
        el('td', {}, capacidade || '—'),
        el('td', {}, ram || '—'),
        el('td', {}, tamanho || '—'),
        origemCell,
        el('td', {}, cor || '—'),
        fornecedorCell,
        precoCell,
      ]

      tbody.appendChild(el('tr', {}, ...cells))
    }
  }

  let allOfertas = ofertas

  // Filtra allOfertas aplicando todos os critérios ativos, exceto o "facet"
  // indicado — usado tanto pra montar a lista final quanto pra calcular quais
  // opções cada multi-select deve oferecer (ex: buscando "iPhone 17 Pro Max",
  // o filtro de Cor só mostra as cores que esse produto realmente tem).
  function baseFilter(excludeFacet) {
    const q = searchInput.value.toLowerCase()
    const capacidades   = excludeFacet === 'capacidade' ? [] : capacidadeMs.getSelected()
    const rams          = excludeFacet === 'ram' ? [] : ramMs.getSelected()
    const tamanhos      = excludeFacet === 'tamanho' ? [] : tamanhoMs.getSelected()
    const cores         = excludeFacet === 'cor' ? [] : corMs.getSelected()
    const fornecedores  = excludeFacet === 'fornecedor' ? [] : fornecedorMs.getSelected()
    const dataMinima = dataInput.value ? new Date(`${dataInput.value}T00:00:00`) : null

    return allOfertas.filter(o => {
      if (categoriaAtiva === 'seminovo') {
        if (!o.seminovo) return false
      } else if (categoriaAtiva !== ALL && !(o.categorias || []).includes(categoriaAtiva)) {
        return false
      }
      if (capacidades.length && !capacidades.includes(o.capacidade)) return false
      if (rams.length && !rams.includes(o.ram)) return false
      if (tamanhos.length && !tamanhos.includes(o.tamanho)) return false
      if (cores.length && !cores.includes(o.cor)) return false
      if (fornecedores.length && !fornecedores.includes(o.fornecedorNome)) return false
      if (dataMinima) {
        const data = toDate(o.quotedAt)
        if (!data || data < dataMinima) return false
      }
      if (!q) return true
      return (
        (o.produtoNomeLower || (o.produtoNome || '').toLowerCase()).includes(q) ||
        (o.variante || '').toLowerCase().includes(q) ||
        (o.fornecedorNome || '').toLowerCase().includes(q)
      )
    })
  }

  function refreshFilterOptions() {
    const capacidades = [...new Set(baseFilter('capacidade').map(o => o.capacidade).filter(Boolean))]
      .sort((a, b) => parseInt(a) - parseInt(b))
    capacidadeMs.setOptions(capacidades)

    const rams = [...new Set(baseFilter('ram').map(o => o.ram).filter(Boolean))]
      .sort((a, b) => parseInt(a) - parseInt(b))
    ramMs.setOptions(rams)

    const tamanhos = [...new Set(baseFilter('tamanho').map(o => o.tamanho).filter(Boolean))]
      .sort((a, b) => parseInt(a) - parseInt(b))
    tamanhoMs.setOptions(tamanhos)

    const cores = [...new Set(baseFilter('cor').map(o => o.cor).filter(Boolean))].sort()
    corMs.setOptions(cores)

    const fornecedores = [...new Set(baseFilter('fornecedor').map(o => o.fornecedorNome).filter(Boolean))].sort()
    fornecedorMs.setOptions(fornecedores)
  }

  function applyFilters() {
    refreshFilterOptions()
    renderRows(baseFilter(null))
  }

  applyFilters()

  searchInput.addEventListener('input', resetPageAndApply)

  return {
    update(newList) {
      allOfertas = newList
      applyFilters()
    },
  }
}
