import { logout, isMaster, can } from '../auth/session.js'
import { navigate } from '../router/index.js'
import { el, svgEl, mount } from '../shared/utils/dom.js'
import { createCotacaoWidget } from '../shared/components/CotacaoDolar.js'

const PAGE_LABELS = {
  '/':              'Painel Inicial',
  '/pedidos':       'Pedidos',
  '/compras':       'Compras',
  '/vendas':        'Vendas',
  '/clientes':      'Clientes',
  '/fornecedores':  'Fornecedores',
  '/produtos':      'Produtos',
  '/recibo':        'Notas de Venda',
  '/orcamentos':    'Orçamentos',
  '/relatorios':    'Relatórios',
  '/financeiro':    'Financeiro',
  '/configuracoes': 'Configurações',
  '/usuarios':      'Usuários',
}

const NAV_ICONS = {
  dashboard: [
    'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10 0h8v8h-8v-8zm0-10h8v8h-8V3z'
  ],
  pedidos: [
    'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
    'M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12'
  ],
  clientes: [
    'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2',
    'M12 11a4 4 0 100-8 4 4 0 000 8z'
  ],
  compras: [
    'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z',
    'M3 6h18',
    'M16 10a4 4 0 01-8 0',
  ],
  vendas: [
    'M23 6l-9.5 9.5-5-5L1 18',
    'M17 6h6v6',
  ],
  orcamentos: [
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
    'M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    'M12 11v6M9 14h6',
  ],
  recibo: [
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
    'M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    'M9 12h6M9 16h4'
  ],
  relatorios: [
    'M18 20V10M12 20V4M6 20v-6'
  ],
  financeiro: [
    'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'
  ],
  fornecedores: [
    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
    'M9 22V12h6v10'
  ],
  produtos: [
    'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z',
    'M7 7h.01'
  ],
  configuracoes: [
    'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3',
    'M1 14h6M9 8h6M17 16h6'
  ],
  usuarios: [
    'M12 15a3 3 0 100-6 3 3 0 000 6z',
    'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'
  ],
}

const NAV_ITEMS = [
  { path: '/',              label: 'Dashboard',      module: null,            iconKey: 'dashboard'     },
  { path: '/orcamentos',    label: 'Orçamentos',     module: null,            iconKey: 'orcamentos'    },
  { path: '/pedidos',       label: 'Pedidos',        module: 'pedidos',       iconKey: 'pedidos'       },
  { path: '/clientes',      label: 'Clientes',       module: 'clientes',      iconKey: 'clientes'      },
  { path: '/produtos',      label: 'Produtos',       module: 'produtos',      iconKey: 'produtos',      wip: true },
  { path: '/fornecedores',  label: 'Fornecedores',   module: 'fornecedores',  iconKey: 'fornecedores',  wip: true },
  { path: '/compras',       label: 'Compras',        module: 'compras',       iconKey: 'compras',       wip: true },
  { path: '/vendas',        label: 'Vendas',         module: 'vendas',        iconKey: 'vendas',        wip: true },
  { path: '/financeiro',    label: 'Financeiro',     module: 'financeiro',    iconKey: 'financeiro',    wip: true },
  { path: '/recibo',        label: 'Notas de Venda', module: 'recibo',        iconKey: 'recibo',        wip: true },
  { path: '/relatorios',    label: 'Relatórios',     module: 'relatorios',    iconKey: 'relatorios',    wip: true },
  { path: '/configuracoes', label: 'Configurações',  module: 'configuracoes', iconKey: 'configuracoes' },
  { path: '/usuarios',      label: 'Usuários',       module: 'usuarios',      iconKey: 'usuarios',      wip: true },
]

function buildIcon(key) {
  const paths = NAV_ICONS[key] || []
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '18', height: '18', class: 'nav-svg-icon',
  })
  for (const d of paths) svg.appendChild(svgEl('path', { d }))
  return svg
}

export function renderLayout(container, profile) {
  const currentPath = window.location.hash.replace('#', '') || '/'
  const pageTitle = PAGE_LABELS[currentPath] || 'Eixo'

  const visibleItems = NAV_ITEMS.filter(item =>
    item.module === null || isMaster() || can(item.module, 'view')
  )

  const navLinks = visibleItems.map(item => {
    if (item.wip) {
      const link = el('div', { class: 'nav-link nav-link--wip' },
        buildIcon(item.iconKey),
        el('span', { class: 'nav-label' }, item.label),
        el('span', { class: 'nav-wip-badge' }, 'Em breve'),
      )
      return link
    }
    const link = el('a', { class: 'nav-link', href: `#${item.path}` },
      buildIcon(item.iconKey),
      el('span', { class: 'nav-label' }, item.label)
    )
    if (currentPath === item.path) link.classList.add('active')
    return link
  })

  const logoImg = el('img', {
    src: `${import.meta.env.BASE_URL}logo.png`,
    alt: 'EIXO',
    class: 'sidebar-logo-img',
  })

  const buildTime = (() => {
    const iso = __BUILD_TIME__
    const d = new Date(iso)
    const dd  = String(d.getDate()).padStart(2, '0')
    const mm  = String(d.getMonth() + 1).padStart(2, '0')
    const yy  = String(d.getFullYear()).slice(2)
    const hh  = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yy} ${hh}:${min}`
  })()

  const sidebar = el('aside', { class: 'sidebar' },
    el('div', { class: 'sidebar-header' },
      el('div', { class: 'sidebar-logo-wrap' }, logoImg),
      el('div', { class: 'sidebar-build-time' }, `v ${buildTime}`)
    ),
    el('nav', { class: 'sidebar-nav' }, ...navLinks),
    el('div', { class: 'sidebar-footer' }, createCotacaoWidget())
  )

  const logoutBtn = el('button', { class: 'btn btn-ghost header-logout' }, 'Sair')
  logoutBtn.addEventListener('click', async () => {
    await logout()
    navigate('/')
    window.location.reload()
  })

  const topHeader = el('header', { class: 'top-header' },
    el('h1', { class: 'top-header-title' }, pageTitle),
    el('div', { class: 'top-header-user' },
      el('div', { class: 'top-header-user-info' },
        el('span', { class: 'top-header-name' }, profile.name || profile.email),
        el('span', { class: 'top-header-company' }, 'Baruk Technology & Consulting')
      ),
      logoutBtn
    )
  )

  const moduleContent = el('div', { id: 'module-content', class: 'module-content' })
  const main = el('main', { class: 'main-area' },
    topHeader,
    el('div', { class: 'main-content' }, moduleContent)
  )

  mount(container, sidebar, main)
}
