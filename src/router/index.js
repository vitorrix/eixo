import { getCurrentProfile, can } from '../auth/session.js'

// Rotas: hash-based (#/pedidos, #/clientes, etc.)
// Cada rota define: módulo requerido + ação 'view' (null = livre para autenticados)
const routes = {
  '/': { module: null, loader: () => import('../modules/dashboard/index.js') },
  '/pedidos':  { module: 'pedidos',  loader: () => import('../modules/pedidos/index.js')  },
  '/compras':  { module: 'compras',  loader: () => import('../modules/compras/index.js')  },
  '/vendas':   { module: 'vendas',   loader: () => import('../modules/vendas/index.js')   },
  '/clientes':     { module: 'clientes',     loader: () => import('../modules/clientes/index.js') },
  '/fornecedores':  { module: 'fornecedores',  loader: () => import('../modules/fornecedores/index.js') },
  '/produtos':      { module: 'produtos',      loader: () => import('../modules/produtos/index.js') },
  '/busca':         { module: 'busca',         loader: () => import('../modules/busca/index.js') },
  '/orcamentos':    { module: null,             loader: () => import('../modules/orcamentos/index.js') },
  '/relatorios':    { module: 'relatorios',    loader: () => import('../modules/relatorios/index.js') },
  '/financeiro':    { module: 'financeiro',    loader: () => import('../modules/financeiro/index.js') },
  '/configuracoes': { module: 'configuracoes', loader: () => import('../modules/configuracoes/index.js') },
  '/usuarios':      { module: 'usuarios',      loader: () => import('../modules/usuarios/index.js') },
  '/ajuda':         { module: null,             loader: () => import('../modules/ajuda/index.js') },
}

const app = document.getElementById('app')

// Cleanup do módulo atual (ex: unsubscribe do Firestore)
let currentCleanup = null

// Zera a referência ANTES de chamar o cleanup e isola erro num try/catch: se o
// cleanup de um módulo lançar exceção, ele não pode mais "envenenar" o router e
// travar toda a navegação seguinte (bug em que os links do menu paravam de
// funcionar até recarregar a página).
function runCleanup() {
  const cleanup = currentCleanup
  currentCleanup = null
  if (typeof cleanup === 'function') {
    try { cleanup() }
    catch (err) { console.error('Erro ao limpar o módulo anterior:', err) }
  }
}

// Token de navegação: com dynamic import + await, dois cliques rápidos podem
// resolver fora de ordem. Cada render pega um token; se outro render começar no
// meio, o antigo é abortado (e seu listener, se já criado, é limpo na hora).
let renderToken = 0

export function navigate(path) {
  window.location.hash = path
}

async function render(path) {
  runCleanup()
  const token = ++renderToken

  try {
    const profile = getCurrentProfile()

    // Sem sessão → tela de login
    if (!profile) {
      const { renderLogin } = await import('../layouts/AuthLayout.js')
      if (token !== renderToken) return
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
    if (token !== renderToken) return // uma navegação mais nova assumiu

    renderLayout(app, profile)
    const cleanup = renderModule(document.getElementById('module-content'))
    // Se outra navegação começou enquanto o módulo montava, descarta este.
    if (token !== renderToken) {
      if (typeof cleanup === 'function') { try { cleanup() } catch { /* ignora */ } }
      return
    }
    if (typeof cleanup === 'function') currentCleanup = cleanup
  } catch (err) {
    console.error('Erro ao renderizar a rota', path, err)
    if (token === renderToken) renderRouteError()
  }
}

// Erro ao carregar um módulo: mostra a mensagem só na área de conteúdo quando o
// layout já existe (sidebar continua clicável — os links são âncoras nativas);
// senão, cai num aviso mínimo no app inteiro.
function renderRouteError() {
  const target = document.getElementById('module-content') || app
  const wrap = document.createElement('div')
  wrap.className = 'error-page'
  const h2 = document.createElement('h2')
  h2.textContent = 'Erro ao carregar'
  const p = document.createElement('p')
  p.textContent = 'Não foi possível abrir esta tela. Tente novamente ou volte ao início.'
  const btn = document.createElement('button')
  btn.textContent = 'Voltar ao início'
  btn.addEventListener('click', () => { navigate('/'); render('/') })
  wrap.append(h2, p, btn)
  target.replaceChildren(wrap)
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
