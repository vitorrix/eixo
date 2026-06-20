import { getCurrentProfile, can } from '../auth/session.js'

// Rotas: hash-based (#/pedidos, #/clientes, etc.)
// Cada rota define: módulo requerido + ação 'view' (null = livre para autenticados)
const routes = {
  '/': { module: null, loader: () => import('../modules/dashboard/index.js') },
  '/pedidos': { module: 'pedidos', loader: () => import('../modules/pedidos/index.js') },
  '/clientes':     { module: 'clientes',     loader: () => import('../modules/clientes/index.js') },
  '/fornecedores':  { module: 'fornecedores',  loader: () => import('../modules/fornecedores/index.js') },
  '/recibo':        { module: 'recibo',        loader: () => import('../modules/recibo/index.js') },
  '/relatorios':    { module: 'relatorios',    loader: () => import('../modules/relatorios/index.js') },
  '/financeiro':    { module: 'financeiro',    loader: () => import('../modules/financeiro/index.js') },
  '/configuracoes': { module: 'configuracoes', loader: () => import('../modules/configuracoes/index.js') },
  '/usuarios':      { module: 'usuarios',      loader: () => import('../modules/usuarios/index.js') },
}

const app = document.getElementById('app')

// Cleanup do módulo atual (ex: unsubscribe do Firestore)
let currentCleanup = null

function runCleanup() {
  if (typeof currentCleanup === 'function') {
    currentCleanup()
    currentCleanup = null
  }
}

export function navigate(path) {
  window.location.hash = path
}

async function render(path) {
  runCleanup()

  const profile = getCurrentProfile()

  // Sem sessão → tela de login
  if (!profile) {
    const { renderLogin } = await import('../layouts/AuthLayout.js')
    renderLogin(app)
    return
  }

  const route = routes[path] || routes['/']

  // Checar permissão de visualização
  if (route.module && !can(route.module, 'view')) {
    renderAccessDenied(app)
    return
  }

  const { renderLayout } = await import('../layouts/MainLayout.js')
  const { render: renderModule } = await route.loader()
  renderLayout(app, profile)
  const cleanup = renderModule(document.getElementById('module-content'))
  if (typeof cleanup === 'function') currentCleanup = cleanup
}

function renderAccessDenied(container) {
  container.replaceChildren()
  const wrap = document.createElement('div')
  wrap.className = 'error-page'

  const h2 = document.createElement('h2')
  h2.textContent = 'Acesso negado'

  const p = document.createElement('p')
  p.textContent = 'Você não tem permissão para acessar este módulo.'

  const btn = document.createElement('button')
  btn.textContent = 'Voltar ao início'
  btn.addEventListener('click', () => navigate('/'))

  wrap.append(h2, p, btn)
  container.appendChild(wrap)
}

export function initRouter() {
  const getPath = () => window.location.hash.replace('#', '') || '/'

  window.addEventListener('hashchange', () => render(getPath()))

  // Expor navigate globalmente para uso em onclick inline
  window.navigate = navigate

  render(getPath())
}
