import { el, mount } from '../../shared/utils/dom.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastError } from '../../shared/components/Toast.js'

// Reaproveitado em dois pontos: "Iniciar Follow-up" (Novos Leads) e
// reagendar dentro de "Marcar como Contatado" (Em Follow-up) — só pede
// data/hora, quem chama decide o que fazer com o valor.
export function abrirFollowUpFormModal({ titulo = 'Iniciar Follow-up', confirmLabel = 'Confirmar', onConfirm }) {
  openModal({
    title: titulo,
    size: 'sm',
    renderBody: (body) => {
      const dtInp = el('input', { type: 'datetime-local', class: 'field-input' })

      mount(body, el('div', { class: 'field' }, el('label', {}, 'Quando retornar'), dtInp))
      body._getValue = () => dtInp.value
      dtInp.focus()
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, confirmLabel)

      cancelBtn.addEventListener('click', close)
      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const value = body?._getValue?.()
        if (!value) return toastError('Escolha a data e a hora do retorno.')

        saveBtn.disabled = true
        saveBtn.textContent = 'Salvando...'
        try {
          await onConfirm(new Date(value))
          close()
        } catch (err) {
          console.error(err)
          toastError('Erro ao salvar.')
          saveBtn.disabled = false
          saveBtn.textContent = confirmLabel
        }
      })

      footerEl.append(cancelBtn, saveBtn)
    },
  })
}
