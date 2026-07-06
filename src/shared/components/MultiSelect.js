import { el, mount } from '../utils/dom.js'

/**
 * createMultiSelect({ label, options, onChange })
 * options: string[] — opções disponíveis (valores == labels exibidos)
 * onChange(selected: string[]) — chamado a cada mudança de seleção
 * Retorna { el, setOptions(options), getSelected() }
 */
export function createMultiSelect({ label, allLabel, onChange }) {
  let options = []
  const selected = new Set()

  const trigger = el('button', { type: 'button', class: 'field-select multiselect-trigger' }, allLabel)
  const panel = el('div', { class: 'multiselect-panel hidden' })
  const root = el('div', { class: 'multiselect' }, trigger, panel)

  const searchInput = el('input', { type: 'text', class: 'multiselect-search', placeholder: 'Buscar...' })
  const selectAllCheckbox = el('input', { type: 'checkbox' })
  const selectAllRow = el('label', { class: 'multiselect-option multiselect-select-all' },
    selectAllCheckbox, el('span', {}, 'Selecionar Tudo'))
  const optionsList = el('div', { class: 'multiselect-options' })
  const clearBtn = el('button', { type: 'button', class: 'btn-link' }, 'Limpar')
  const closeBtn = el('button', { type: 'button', class: 'btn-link' }, 'Fechar')
  const closeXBtn = el('button', { type: 'button', class: 'multiselect-close', 'aria-label': 'Fechar' }, '✕')

  mount(panel,
    el('div', { class: 'multiselect-header' }, el('strong', {}, label), closeXBtn),
    searchInput,
    selectAllRow,
    optionsList,
    el('div', { class: 'multiselect-footer' }, clearBtn, closeBtn),
  )

  function updateTrigger() {
    trigger.textContent = selected.size === 0
      ? allLabel
      : `${selected.size} selecionada${selected.size > 1 ? 's' : ''}`
  }

  function renderOptions() {
    const q = searchInput.value.toLowerCase()
    optionsList.replaceChildren()
    for (const opt of options) {
      if (q && !opt.toLowerCase().includes(q)) continue
      const checkbox = el('input', { type: 'checkbox' })
      checkbox.checked = selected.has(opt)
      const row = el('label', { class: 'multiselect-option' }, checkbox, el('span', {}, opt))
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(opt)
        else selected.delete(opt)
        selectAllCheckbox.checked = selected.size === options.length && options.length > 0
        updateTrigger()
        onChange([...selected])
      })
      optionsList.appendChild(row)
    }
  }

  selectAllCheckbox.addEventListener('change', () => {
    selected.clear()
    if (selectAllCheckbox.checked) options.forEach(o => selected.add(o))
    renderOptions()
    updateTrigger()
    onChange([...selected])
  })

  searchInput.addEventListener('input', renderOptions)

  clearBtn.addEventListener('click', () => {
    selected.clear()
    selectAllCheckbox.checked = false
    renderOptions()
    updateTrigger()
    onChange([...selected])
  })

  function closePanel() { panel.classList.add('hidden') }
  closeBtn.addEventListener('click', closePanel)
  closeXBtn.addEventListener('click', closePanel)

  trigger.addEventListener('click', () => {
    panel.classList.toggle('hidden')
  })

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) closePanel()
  })

  return {
    el: root,
    setOptions(newOptions) {
      options = newOptions
      for (const v of [...selected]) {
        if (!options.includes(v)) selected.delete(v)
      }
      selectAllCheckbox.checked = selected.size === options.length && options.length > 0
      renderOptions()
      updateTrigger()
    },
    getSelected() {
      return [...selected]
    },
  }
}
