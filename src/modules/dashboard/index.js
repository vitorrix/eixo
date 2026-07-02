import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { getCurrentProfile } from '../../auth/session.js'
import { maskPhone, brl } from '../../shared/utils/formatters.js'
import { subscribeAniversariantes } from '../clientes/service.js'
import { collection, query, where, getCountFromServer } from 'firebase/firestore'
import { db } from '../../firebase.js'

const MODULE_CARDS = [
  { label: 'Pedidos',      sub: 'Gerenciar pedidos',       path: '/pedidos',       color: '#6366f1', icon: 'pedidos'      },
  { label: 'Clientes',     sub: 'Cadastro de clientes',    path: '/clientes',      color: '#10B981', icon: 'clientes'     },
  { label: 'Fornecedores', sub: 'Cadastro de fornecedores',path: '/fornecedores',  color: '#f59e0b', icon: 'fornecedores' },
  { label: 'Financeiro',   sub: 'Receitas e despesas',     path: '/financeiro',    color: '#3b82f6', icon: 'financeiro'   },
  { label: 'Produtos',     sub: 'Catálogo de produtos',    path: '/produtos',      color: '#ec4899', icon: 'produtos'     },
]

// Dados fictícios — sem lançamentos financeiros reais ainda
const FAKE_REVENUE = [
  { label: 'Fev', value: 18400 },
  { label: 'Mar', value: 21200 },
  { label: 'Abr', value: 19800 },
  { label: 'Mai', value: 24500 },
  { label: 'Jun', value: 27300 },
  { label: 'Jul', value: 31200 },
]

const STAT_CARDS = [
  { label: 'Clientes', collection: 'clientes', color: '#10B981', path: '/clientes', sub: 'registros'  },
  { label: 'Pedidos',  collection: 'pedidos',  color: '#6366f1', path: '/pedidos',  sub: 'este mês'   },
]

const ICON_PATHS = {
  pedidos:      ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z','M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12'],
  clientes:     ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2','M12 11a4 4 0 100-8 4 4 0 000 8z'],
  fornecedores: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z','M9 22V12h6v10'],
  financeiro:   ['M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6'],
  produtos:     ['M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z','M7 7h.01'],
}

function buildIcon(key, color) {
  const paths = ICON_PATHS[key] || []
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: color,
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '22', height: '22',
  })
  for (const d of paths) svg.appendChild(svgEl('path', { d }))
  return svg
}

function buildRevenueChart() {
  const max = Math.max(...FAKE_REVENUE.map(d => d.value))
  const last = FAKE_REVENUE[FAKE_REVENUE.length - 1]
  const prev = FAKE_REVENUE[FAKE_REVENUE.length - 2]
  const deltaPct = Math.round(((last.value - prev.value) / prev.value) * 100)

  const headlineValue = el('span', { class: 'chart-headline-value' }, brl(last.value))
  const headlineDelta = el('span', { class: `chart-headline-delta ${deltaPct >= 0 ? 'up' : 'down'}` },
    `${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct)}%`)
  const headlineLabel = el('span', { class: 'chart-headline-label' }, `vs. ${prev.label}`)

  function showMonth(d) {
    headlineValue.textContent = brl(d.value)
    headlineLabel.textContent = d.label
  }
  function resetHeadline() {
    headlineValue.textContent = brl(last.value)
    headlineLabel.textContent = `vs. ${prev.label}`
  }

  const barCols = FAKE_REVENUE.map(d => {
    const fill = el('div', { class: 'chart-bar-fill' })
    fill.style.height = `${Math.round((d.value / max) * 100)}%`
    const bar = el('div', { class: 'chart-bar' }, fill)
    const col = el('div', { class: 'chart-bar-col' }, bar)
    col.addEventListener('mouseenter', () => showMonth(d))
    col.addEventListener('mouseleave', resetHeadline)
    return col
  })

  const axisLabels = FAKE_REVENUE.map(d => el('span', { class: 'chart-axis-label' }, d.label))

  return el('div', { class: 'chart-card' },
    el('div', { class: 'chart-header' },
      el('span', { class: 'chart-title' }, 'Faturamento'),
      el('span', { class: 'chart-badge-mock' }, 'dados fictícios')
    ),
    el('div', { class: 'chart-headline' }, headlineValue, headlineDelta, headlineLabel),
    el('div', { class: 'chart-plot' }, ...barCols),
    el('div', { class: 'chart-axis-row' }, ...axisLabels),
    el('p', { class: 'chart-note' }, 'Gráfico ilustrativo — nenhum lançamento financeiro registrado ainda.')
  )
}

export function render(container) {
  const profile = getCurrentProfile()
  const name = (profile?.name || profile?.email || '').split(' ')[0]

  const greeting = el('h2', {})
  greeting.textContent = `Olá, ${name}!`
  const sub = el('p', { class: 'text-muted' }, 'Bem-vindo ao Eixo. Selecione um módulo para começar.')

  // Stat cards
  const today = new Date()
  const yy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const mesStart = `${yy}-${mm}-01`
  const mesEnd   = `${yy}-${mm}-31`

  const statCards = STAT_CARDS.map(s => {
    const valueEl = el('div', { class: 'stat-card-value' }, '—')
    const card = el('div', { class: 'stat-card' },
      el('div', { class: 'stat-card-accent', style: `background:${s.color}` }),
      el('div', { class: 'stat-card-body' },
        el('div', { class: 'stat-card-label' }, s.label),
        valueEl,
        el('div', { class: 'stat-card-sub' }, s.sub)
      )
    )
    card.addEventListener('click', () => { window.location.hash = s.path })

    const col = collection(db, s.collection)
    const q = s.collection === 'pedidos'
      ? query(col, where('dataContato', '>=', mesStart), where('dataContato', '<=', mesEnd))
      : col

    getCountFromServer(q)
      .then(snap => { valueEl.textContent = snap.data().count })
      .catch(() => { valueEl.textContent = '?' })

    return card
  })

  const birthdaySection = el('div', { class: 'birthday-section' })

  // Module shortcut cards
  const moduleCards = MODULE_CARDS.map(m => {
    const wrap = el('div', { class: 'dash-card-icon-wrap', style: `background:${m.color}1a` },
      buildIcon(m.icon, m.color)
    )
    const card = el('div', { class: 'dash-card' },
      wrap,
      el('div', {},
        el('div', { class: 'dash-card-label' }, m.label),
        el('div', { class: 'dash-card-sub' }, m.sub)
      )
    )
    card.addEventListener('click', () => { window.location.hash = m.path })
    return card
  })

  mount(container,
    el('div', { class: 'page-header' }, greeting, sub),
    el('p', { class: 'section-label' }, 'Acesso rápido'),
    el('div', { class: 'dashboard-cards' }, ...moduleCards),
    el('div', { class: 'stat-cards' }, ...statCards),
    el('div', { class: 'dashboard-row' }, birthdaySection, buildRevenueChart())
  )

  const unsubBirthday = subscribeAniversariantes((aniversariantes) => {
    birthdaySection.replaceChildren()
    if (!aniversariantes.length) {
      birthdaySection.append(
        el('div', { class: 'birthday-title' },
          el('span', { class: 'birthday-emoji' }, '🎂'),
          el('strong', {}, 'Aniversariantes de hoje')
        ),
        el('p', { class: 'text-muted' }, 'Nenhum aniversariante hoje.')
      )
      return
    }
    const title = el('div', { class: 'birthday-title' },
      el('span', { class: 'birthday-emoji' }, '🎂'),
      el('strong', {}, `Aniversariante${aniversariantes.length > 1 ? 's' : ''} de hoje`)
    )
    const list = el('div', { class: 'birthday-list' })
    for (const c of aniversariantes) {
      list.appendChild(el('div', { class: 'birthday-item' },
        el('span', { class: 'birthday-name' }, c.name),
        el('span', { class: 'birthday-phone' }, maskPhone(c.phone || ''))
      ))
    }
    birthdaySection.append(title, list)
  })

  return unsubBirthday
}
