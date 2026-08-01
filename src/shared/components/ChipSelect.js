import { el } from '../utils/dom.js'

// Seletor de opção única em formato de botões (chips) — mesmo visual do
// "Forma de pagamento" do Pedido, só que de escolha única (clicar troca a
// ativa, não acumula) em vez de multi-seleção. Usa a classe .status-chip-btn
// já existente, então fica idêntico visualmente ao do Pedido.
// options: string[] ou { value, label }[]
export function createChipSelect(options, { value = '', onChange } = {}) {
  let current = value
  const norm = options.map(o => typeof o === 'string' ? { value: o, label: o } : o)

  const btns = norm.map(({ value: val, label }) => {
    const btn = el('button', { type: 'button', class: 'status-chip-btn' }, label)
    if (val === current) btn.classList.add('active')
    btn.addEventListener('click', () => {
      current = val
      btns.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      onChange?.(val)
    })
    return btn
  })

  const wrap = el('div', { class: 'status-chips-row' }, ...btns)

  return {
    el: wrap,
    getValue: () => current,
    setValue(v) {
      current = v
      btns.forEach((b, i) => b.classList.toggle('active', norm[i].value === v))
    },
  }
}
