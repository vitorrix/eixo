import { el } from '../utils/dom.js'

let container = null

function getContainer() {
  if (!container) {
    container = el('div', { class: 'toast-container', id: 'toast-container' })
    document.body.appendChild(container)
  }
  return container
}

function show(message, type) {
  const c = getContainer()
  const t = el('div', { class: `toast toast-${type}` }, message)
  c.appendChild(t)
  requestAnimationFrame(() => t.classList.add('toast-in'))
  setTimeout(() => {
    t.classList.remove('toast-in')
    t.addEventListener('transitionend', () => t.remove(), { once: true })
  }, 3200)
}

export const toastSuccess = (msg) => show(msg, 'success')
export const toastError   = (msg) => show(msg, 'error')
export const toastInfo    = (msg) => show(msg, 'info')
