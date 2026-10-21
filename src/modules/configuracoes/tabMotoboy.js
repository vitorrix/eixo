import { el, mount } from '../../shared/utils/dom.js'
import { saveOperacoes } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

export function renderTabMotoboy(container, operacoes, onSaved) {
  const valorInp = el('input', { type: 'number', class: 'field-input', step: '0.1', min: '0', style: 'max-width:160px' })
  valorInp.value = operacoes.motoboy?.valorKm ?? 2.5

  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')
  saveBtn.addEventListener('click', async () => {
    const valorKm = parseFloat(valorInp.value)
    if (!(valorKm >= 0)) return toastError('Informe um valor por km válido.')
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
    try {
      const updated = { ...operacoes, motoboy: { ...(operacoes.motoboy || {}), valorKm } }
      await saveOperacoes(updated)
      onSaved(updated)
      toastSuccess('Valor por km salvo.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar.')
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar'
    }
  })

  mount(container,
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Motoboy'),
      el('p', { class: 'text-muted', style: 'font-size:13px;margin-bottom:10px' },
        'Valor cobrado por quilômetro rodado — usado como padrão no acerto do motoboy (dá para ajustar em cada acerto).'),
      el('div', { class: 'field' }, el('label', {}, 'Valor por km (R$)'), valorInp),
    ),
    el('div', { class: 'config-actions' }, saveBtn),
  )
}
