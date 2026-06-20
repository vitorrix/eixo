import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { getCurrentProfile } from '../../auth/session.js'
import { maskPhone } from '../../shared/utils/formatters.js'
import { subscribeAniversariantes } from '../clientes/service.js'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../../firebase.js'

const MODULE_CARDS = [
  { label: 'Pedidos',      sub: 'Gerenciar pedidos',       path: '/pedidos',       color: '#6366f1', icon: 'pedidos'      },
  { label: 'Clientes',     sub: 'Cadastro de clientes',    path: '/clientes',      color: '#10B981', icon: 'clientes'     },
  { label: 'Fornecedores', sub: 'Cadastro de fornecedores',path: '/fornecedores',  color: '#f59e0b', icon: 'fornecedores' },
  { label: 'Financeiro',   sub: 'Receitas e despesas',     path: '/financeiro',    color: '#3b82f6', icon: 'financeiro'   },
]

const STAT_CARDS = [
  { label: 'Clientes',     collection: 'clientes',     color: '#10B981', path: '/clientes'     },
  { label: 'Pedidos',      collection: 'pedidos',      color: '#6366f1', path: '/pedidos'      },
  { label: 'Fornecedores', collection: 'fornecedores', color: '#f59e0b', path: '/fornecedores' },
]

const ICON_PATHS = {
  pedidos:      ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z','M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12'],
  clientes:     ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2','M12 11a4 4 0 100-8 4 4 0 000 8z'],
  fornecedores: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z','M9 22V12h6v10'],
  financeiro:   ['M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6'],
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

export function render(container) {
  const profile = getCurrentProfile()
  const name = (profile?.name || profile?.email || '').split(' ')[0]

  const greeting = el('h2', {})
  greeting.textContent = `Olá, ${name}!`
  const sub = el('p', { class: 'text-muted' }, 'Bem-vindo ao Eixo. Selecione um módulo para começar.')

  // Stat cards
  const statCards = STAT_CARDS.map(s => {
    const valueEl = el('div', { class: 'stat-card-value' }, '—')
    const card = el('div', { class: 'stat-card' },
      el('div', { class: 'stat-card-accent', style: `background:${s.color}` }),
      el('div', { class: 'stat-card-body' },
        el('div', { class: 'stat-card-label' }, s.label),
        valueEl,
        el('div', { class: 'stat-card-sub' }, 'registros')
      )
    )
    card.addEventListener('click', () => { window.location.hash = s.path })

    getCountFromServer(collection(db, s.collection))
      .then(snap => { valueEl.textContent = snap.data().count })
      .catch(() => { valueEl.textContent = '0' })

    return card
  })

  const birthdaySection = el('div', { class: 'birthday-section hidden' })

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
    el('div', { class: 'stat-cards' }, ...statCards),
    birthdaySection,
    el('p', { class: 'section-label' }, 'Acesso rápido'),
    el('div', { class: 'dashboard-cards' }, ...moduleCards)
  )

  const unsubBirthday = subscribeAniversariantes((aniversariantes) => {
    birthdaySection.replaceChildren()
    if (!aniversariantes.length) { birthdaySection.classList.add('hidden'); return }
    birthdaySection.classList.remove('hidden')
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
