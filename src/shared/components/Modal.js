import { el } from '../utils/dom.js'

/**
 * openModal({ title, size?, renderBody, footer? })
 * renderBody(bodyEl) — função que popula o corpo do modal
 * footer(close)      — função que retorna um Node de rodapé (opcional)
 * Retorna { close }
 */
export function openModal({ title, size = 'md', renderBody, footer }) {
  const overlay = el('div', { class: 'modal-overlay' })
  const modal   = el('div', { class: `modal modal-${size}` })

  const closeBtn = el('button', { class: 'modal-close', type: 'button', 'aria-label': 'Fechar' }, '✕')

  const header = el('div', { class: 'modal-header' },
    el('h3', { class: 'modal-title' }, title),
    closeBtn
  )
  const body = el('div', { class: 'modal-body' })

  modal.append(header, body)

  if (footer) {
    const footerEl = el('div', { class: 'modal-footer' })
    footer(close, footerEl)
    modal.appendChild(footerEl)
  }

  overlay.appendChild(modal)
  document.body.appendChild(overlay)

  requestAnimationFrame(() => overlay.classList.add('modal-in'))

  function close() {
    overlay.classList.remove('modal-in')
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
  }

  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
  })

  // Popula após montar no DOM
  renderBody(body, close)

  return { close }
}

/** Modal de confirmação simples */
export function openConfirm({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm }) {
  openModal({
    title,
    size: 'sm',
    renderBody: (body) => {
      const p = el('p', { class: 'confirm-message' }, message)
      body.appendChild(p)
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const confirmBtn = el('button', {
        class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
        type: 'button',
      }, confirmLabel)

      cancelBtn.addEventListener('click', close)
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true
        confirmBtn.textContent = 'Aguarde...'
        await onConfirm()
        close()
      })

      footerEl.append(cancelBtn, confirmBtn)
    },
  })
}
