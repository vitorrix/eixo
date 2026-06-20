import { logout, isMaster, can } from '../auth/session.js'
import { navigate } from '../router/index.js'
import { el, mount } from '../shared/utils/dom.js'
import { createCotacaoWidget } from '../shared/components/CotacaoDolar.js'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', module: null, icon: '◼' },
  { path: '/pedidos', label: 'Pedidos', module: 'pedidos', icon: '📦' },
  { path: '/clientes', label: 'Clientes', module: 'clientes', icon: '👤' },
  { path: '/orcamento', label: 'Orçamentos', module: 'orcamento', icon: '📋' },
  { path: '/recibo', label: 'Recibos', module: 'recibo', icon: '🧾' },
  { path: '/relatorios', label: 'Relatórios', module: 'relatorios', icon: '📊' },
  { path: '/financeiro', label: 'Financeiro', module: 'financeiro', icon: '💰' },
  { path: '/usuarios', label: 'Usuários', module: 'usuarios', icon: '⚙️' },
]

export function renderLayout(container, profile) {
  // Itens de nav que o usuário tem permissão para ver
  const visibleItems = NAV_ITEMS.filter(item =>
    item.module === null || isMaster() || can(item.module, 'view')
  )

  const navLinks = visibleItems.map(item => {
    const link = el('a', { class: 'nav-link', href: `#${item.path}` },
      el('span', { class: 'nav-icon' }, item.icon),
      el('span', { class: 'nav-label' }, item.label)
    )
    if (window.location.hash === `#${item.path}`) link.classList.add('active')
    return link
  })

  const userTag = el('div', { class: 'nav-user' },
    el('span', { class: 'nav-user-name' }, profile.name || profile.email),
    el('span', { class: 'nav-user-role' }, profile.role === 'master' ? 'Master' : 'Funcionário')
  )

  const logoutBtn = el('button', { class: 'btn btn-ghost nav-logout' }, 'Sair')
  logoutBtn.addEventListener('click', async () => {
    await logout()
    navigate('/')
    window.location.reload()
  })

  const logoImg = el('img', {
    src: `${import.meta.env.BASE_URL}logo.png`,
    alt: 'EIXO — Plataforma Baruk',
    class: 'sidebar-logo-img',
  })

  const sidebar = el('aside', { class: 'sidebar' },
    el('div', { class: 'sidebar-header' },
      el('div', { class: 'sidebar-logo-wrap' }, logoImg)
    ),
    el('nav', { class: 'sidebar-nav' }, ...navLinks),
    el('div', { class: 'sidebar-footer' }, createCotacaoWidget(), userTag, logoutBtn)
  )

  const moduleContent = el('div', { id: 'module-content', class: 'module-content' })
  const main = el('main', { class: 'main-area' }, moduleContent)

  mount(container, sidebar, main)
}
