import { el, mount } from '../../shared/utils/dom.js'
import { getCurrentProfile } from '../../auth/session.js'
import { maskPhone } from '../../shared/utils/formatters.js'
import { subscribeAniversariantes } from '../clientes/service.js'

export function render(container) {
  const profile = getCurrentProfile()
  const name = profile?.name || profile?.email || ''

  const greeting = el('h2', {})
  greeting.textContent = `Olá, ${name}!`
  const sub = el('p', { class: 'text-muted' }, 'Selecione um módulo no menu lateral para começar.')

  const birthdaySection = el('div', { class: 'birthday-section hidden' })

  const cards = el('div', { class: 'dashboard-cards' },
    card('📦', 'Pedidos', '/pedidos'),
    card('👤', 'Clientes', '/clientes'),
    card('📋', 'Orçamentos', '/orcamento'),
    card('🧾', 'Recibos', '/recibo'),
  )

  mount(container,
    el('div', { class: 'page-header' }, greeting, sub),
    birthdaySection,
    cards
  )

  const unsubBirthday = subscribeAniversariantes((aniversariantes) => {
    birthdaySection.replaceChildren()

    if (!aniversariantes.length) {
      birthdaySection.classList.add('hidden')
      return
    }

    birthdaySection.classList.remove('hidden')

    const title = el('div', { class: 'birthday-title' },
      el('span', { class: 'birthday-emoji' }, '🎂'),
      el('strong', {}, `Aniversariante${aniversariantes.length > 1 ? 's' : ''} de hoje`)
    )

    const list = el('div', { class: 'birthday-list' })
    for (const c of aniversariantes) {
      const phone = maskPhone(c.phone || '')
      const row = el('div', { class: 'birthday-item' },
        el('span', { class: 'birthday-name' }, c.name),
        el('span', { class: 'birthday-phone' }, phone)
      )
      list.appendChild(row)
    }

    birthdaySection.append(title, list)
  })

  return unsubBirthday
}

function card(icon, label, path) {
  const c = el('div', { class: 'dash-card' },
    el('span', { class: 'dash-card-icon' }, icon),
    el('span', { class: 'dash-card-label' }, label)
  )
  c.addEventListener('click', () => { window.location.hash = path })
  return c
}
