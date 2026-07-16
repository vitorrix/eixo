import { el } from '../utils/dom.js'
import { PRESETS, presetRange, periodoLabel } from '../utils/periodo.js'

// Seletor de período reutilizável nos relatórios: um select de presets
// (Hoje, Últimos 7 dias, Este mês...) + campos De/Até que aparecem quando o
// usuário escolhe "Escolher datas". Chama onChange({ de, ate }) a cada
// mudança. Retorna { el, getValue }.
export function createPeriodoPicker({ initialPreset = 'este-mes', onChange } = {}) {
  let { de, ate } = presetRange(initialPreset)

  const sel = el('select', { class: 'field-select' },
    ...PRESETS.map(p => el('option', { value: p.key }, p.label)),
    el('option', { value: 'custom' }, 'Escolher datas'),
  )
  sel.value = initialPreset

  const deInp = el('input', { type: 'date', value: de })
  const ateInp = el('input', { type: 'date', value: ate })
  const customWrap = el('div', { class: 'periodo-custom' },
    el('div', { class: 'field' }, el('label', {}, 'De'), deInp),
    el('div', { class: 'field' }, el('label', {}, 'Até'), ateInp),
  )
  customWrap.style.display = 'none'

  const label = el('span', { class: 'periodo-label' }, periodoLabel(de, ate))

  function emit() {
    label.textContent = periodoLabel(de, ate)
    onChange?.({ de, ate })
  }

  sel.addEventListener('change', () => {
    if (sel.value === 'custom') {
      customWrap.style.display = ''
      // mantém o range atual como ponto de partida da edição manual
      deInp.value = de
      ateInp.value = ate
      return
    }
    customWrap.style.display = 'none'
    ;({ de, ate } = presetRange(sel.value))
    emit()
  })

  function onCustomChange() {
    if (!deInp.value || !ateInp.value) return
    // normaliza caso o usuário inverta as datas
    de = deInp.value <= ateInp.value ? deInp.value : ateInp.value
    ate = deInp.value <= ateInp.value ? ateInp.value : deInp.value
    emit()
  }
  deInp.addEventListener('change', onCustomChange)
  ateInp.addEventListener('change', onCustomChange)

  const root = el('div', { class: 'periodo-picker' },
    el('div', { class: 'periodo-picker-row' }, sel, label),
    customWrap,
  )

  return { el: root, getValue: () => ({ de, ate }) }
}
