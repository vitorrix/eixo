import { el } from '../utils/dom.js'

/**
 * createAutocomplete({ placeholder, items, onSelect, extraOption, initialValue, maxResults })
 * - items: string[]
 * - onSelect(value): chamado ao selecionar ou digitar
 * - extraOption: { getLabel(q), action(q) } — linha extra no final (ex: cadastrar)
 * - Retorna { el, getValue, setValue, setItems }
 *
 * O dropdown é renderizado no <body> (portal) para não ser cortado por overflow.
 */
export function createAutocomplete({
  placeholder  = '',
  items        = [],
  onSelect,
  extraOption,
  initialValue = '',
  maxResults   = 20,
} = {}) {
  const input    = el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder })
  const dropdown = el('div', { class: 'ac-dropdown' })

  input.value = initialValue

  let activeIdx = -1
  let visible   = false

  // ── Posicionamento portal ────────────────────────────────────────────────
  function reposition() {
    const r = input.getBoundingClientRect()
    dropdown.style.top   = `${r.bottom + window.scrollY + 3}px`
    dropdown.style.left  = `${r.left   + window.scrollX}px`
    dropdown.style.width = `${r.width}px`
  }

  function show(results, q) {
    activeIdx = -1
    dropdown.replaceChildren()

    results.forEach((text, i) => {
      const opt = el('div', { class: 'ac-opt' }, text)
      opt.addEventListener('mousedown', e => { e.preventDefault(); pick(text) })
      opt.addEventListener('mouseover', () => highlight(i))
      dropdown.appendChild(opt)
    })

    if (extraOption && q.trim()) {
      const opt = el('div', { class: 'ac-opt ac-opt-extra' }, extraOption.getLabel(q))
      opt.addEventListener('mousedown', e => { e.preventDefault(); hide(); extraOption.action(q) })
      dropdown.appendChild(opt)
    }

    if (!dropdown.children.length) { hide(); return }
    reposition()
    if (!visible) { document.body.appendChild(dropdown); visible = true }
  }

  function hide() {
    if (visible) { dropdown.remove(); visible = false; activeIdx = -1 }
  }

  function highlight(i) {
    ;[...dropdown.children].forEach((o, j) => o.classList.toggle('active', j === i))
    activeIdx = i
  }

  function pick(value) {
    input.value = value
    hide()
    onSelect?.(value)
  }

  function filter(q) {
    if (!q.trim()) return []
    const lq = q.toLowerCase()
    return items.filter(s => s.toLowerCase().includes(lq)).slice(0, maxResults)
  }

  // ── Eventos ───────────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    const q = input.value
    if (q.trim()) show(filter(q), q)
    else hide()
    onSelect?.(q)
  })

  input.addEventListener('keydown', e => {
    if (!visible) return
    const opts = [...dropdown.children]
    if (e.key === 'ArrowDown') {
      e.preventDefault(); highlight(Math.min(activeIdx + 1, opts.length - 1))
      opts[activeIdx]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); highlight(Math.max(activeIdx - 1, 0))
      opts[activeIdx]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      const opt = opts[activeIdx]
      if (opt.classList.contains('ac-opt-extra')) { hide(); extraOption?.action(input.value) }
      else pick(opt.textContent)
    } else if (e.key === 'Escape') {
      hide()
    }
  })

  input.addEventListener('blur',  () => setTimeout(hide, 150))
  input.addEventListener('focus', () => {
    const q = input.value
    if (q.trim()) show(filter(q), q)
  })

  window.addEventListener('scroll',  () => { if (visible) reposition() }, { passive: true })
  window.addEventListener('resize',  () => { if (visible) reposition() }, { passive: true })

  return {
    el:       input,
    getValue: ()    => input.value,
    setValue: v     => { input.value = v },
    setItems: list  => { items = list },
  }
}
