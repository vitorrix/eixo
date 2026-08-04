import { el } from '../utils/dom.js'
import { PRESETS, presetRange, periodoLabel, isoLocal, primeiroDiaMes, ultimoDiaMes } from '../utils/periodo.js'

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

  // Setas pra pular pro mês anterior/seguinte sem reabrir o dropdown — usa o
  // mês de "de" como referência, então funciona mesmo vindo de um preset que
  // não é "Este mês" (ex: usuário filtrou uma semana e quer ver o mês todo).
  // Sincroniza o select com "Este mês"/"Mês passado" quando o mês resultante
  // bate com um desses presets, senão cai em "Escolher datas".
  function shiftMonth(delta) {
    const ref = new Date(`${de}T00:00:00`)
    const alvo = new Date(ref.getFullYear(), ref.getMonth() + delta, 1)
    de = isoLocal(primeiroDiaMes(alvo))
    ate = isoLocal(ultimoDiaMes(alvo))

    const hoje = new Date()
    const mesPassadoRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    if (alvo.getFullYear() === hoje.getFullYear() && alvo.getMonth() === hoje.getMonth()) {
      sel.value = 'este-mes'
    } else if (alvo.getFullYear() === mesPassadoRef.getFullYear() && alvo.getMonth() === mesPassadoRef.getMonth()) {
      sel.value = 'mes-passado'
    } else {
      sel.value = 'custom'
    }
    customWrap.style.display = sel.value === 'custom' ? '' : 'none'
    if (sel.value === 'custom') { deInp.value = de; ateInp.value = ate }
    emit()
  }

  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn', title: 'Mês anterior' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn', title: 'Próximo mês' }, '›')
  prevBtn.addEventListener('click', () => shiftMonth(-1))
  nextBtn.addEventListener('click', () => shiftMonth(1))

  const root = el('div', { class: 'periodo-picker' },
    el('div', { class: 'periodo-picker-row' }, prevBtn, sel, nextBtn, label),
    customWrap,
  )

  return { el: root, getValue: () => ({ de, ate }) }
}
