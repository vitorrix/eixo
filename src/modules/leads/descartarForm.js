import { el, mount } from '../../shared/utils/dom.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { DISCARD_REASON_META } from './constants.js'
import { descartarLead } from './service.js'

// Mesmo fluxo usado em "Novos Leads" e "Em Follow-up" — motivo fechado (pra
// dar pra tirar estatística no Histórico depois) + nota livre opcional.
export function abrirDescartarModal(lead) {
  openModal({
    title: `Descartar — ${lead.name || lead.phone}`,
    size: 'sm',
    renderBody: (body) => {
      let motivo = 'sem_interesse'
      const motivoSel = el('select', { class: 'field-select' },
        ...Object.entries(DISCARD_REASON_META).map(([key, label]) => el('option', { value: key }, label))
      )
      motivoSel.value = motivo
      motivoSel.addEventListener('change', () => { motivo = motivoSel.value })

      const notaInp = el('textarea', { rows: '3', class: 'field-textarea', placeholder: 'Detalhe opcional...' })

      mount(body,
        el('div', { class: 'field' }, el('label', {}, 'Motivo'), motivoSel),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Nota (opcional)'), notaInp),
      )
      body._getPayload = () => ({ discardReason: motivoSel.value, discardNote: notaInp.value.trim() })
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-danger', type: 'button' }, 'Descartar')

      cancelBtn.addEventListener('click', close)
      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const payload = body?._getPayload?.()
        if (!payload) return

        saveBtn.disabled = true
        try {
          await descartarLead(lead.id, payload)
          toastSuccess('Lead descartado.')
          close()
        } catch (err) {
          console.error(err)
          toastError('Erro ao descartar.')
          saveBtn.disabled = false
        }
      })

      footerEl.append(cancelBtn, saveBtn)
    },
  })
}
