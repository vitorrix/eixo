import { el, mount } from '../../shared/utils/dom.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastError } from '../../shared/components/Toast.js'
import { criarSeletorInteresse } from './constants.js'

// Reaproveitado em dois pontos: "Iniciar Follow-up" (Novos Leads) e
// "Reagendar" (Sem Resposta voltando pra Follow-up) — os dois representam um
// contato de verdade acontecendo agora, por isso pedem nota (o que foi
// tratado) e permitem marcar/trocar o nível de interesse, exatamente como o
// botão "Nota" de dentro de Em Follow-up (ver botaoNota em board.js).
export function abrirFollowUpFormModal({ titulo = 'Iniciar Follow-up', confirmLabel = 'Confirmar', interesseInicial = null, onConfirm }) {
  openModal({
    title: titulo,
    size: 'sm',
    renderBody: (body) => {
      const notaInp = el('textarea', { rows: '3', class: 'field-textarea', placeholder: 'O que foi conversado neste contato...' })
      const seletor = criarSeletorInteresse(interesseInicial)
      const dtInp = el('input', { type: 'datetime-local', class: 'field-input' })

      mount(body,
        el('div', { class: 'field' }, el('label', {}, 'O que foi tratado neste contato'), notaInp),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Nível de interesse'), seletor.el),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Quando retornar'), dtInp),
      )
      body._getValue = () => ({ nextFollowUpAt: dtInp.value, nota: notaInp.value, interesse: seletor.getValue() })
      notaInp.focus()
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, confirmLabel)

      cancelBtn.addEventListener('click', close)
      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const value = body?._getValue?.()
        if (!value?.nota?.trim()) return toastError('Descreva o que foi tratado neste contato.')
        if (!value?.nextFollowUpAt) return toastError('Escolha a data e a hora do retorno.')

        saveBtn.disabled = true
        saveBtn.textContent = 'Salvando...'
        try {
          await onConfirm({ nextFollowUpAt: new Date(value.nextFollowUpAt), nota: value.nota, interesse: value.interesse })
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
