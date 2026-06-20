import { el, mount } from '../../shared/utils/dom.js'

export function render(container) {
  mount(container,
    el('div', { class: 'page-header' },
      el('h2', {}, 'urecibo'),
      el('p', { class: 'text-muted' }, 'Módulo em desenvolvimento.')
    )
  )
}
