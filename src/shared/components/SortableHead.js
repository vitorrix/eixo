import { el } from '../utils/dom.js'

// Cabeçalho de tabela com colunas clicáveis pra ordenar — mesmo padrão já
// usado em Pedidos/Fornecedores, extraído aqui pra reaproveitar nas outras
// listas do sistema. `sortValue(item, key)` extrai o valor comparável de cada
// linha pra cada coluna; string vira comparação por locale pt-BR (já
// case-insensitive), número vira subtração direta. Coluna sem "key" (ex:
// Ações) fica só como th normal, sem indicador nem clique.
export function createSortableHead(defs, { sortValue, initialCol, initialDir = 'asc', onSort }) {
  let sortCol = initialCol
  let sortDir = initialDir

  const ths = defs.map(({ key, label, cls }) => {
    if (!key) return el('th', { class: cls || '' }, label)
    const clsList = [cls, 'th-sortable'].filter(Boolean).join(' ')
    const ind = el('span', { class: 'sort-ind' }, '')
    const th = el('th', { class: clsList }, label, ind)
    th.addEventListener('click', () => {
      if (sortCol === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      else { sortCol = key; sortDir = 'asc' }
      updateHeaders()
      onSort()
    })
    return th
  })

  function updateHeaders() {
    defs.forEach(({ key }, i) => {
      if (!key) return
      const th = ths[i]
      th.classList.toggle('sort-active', sortCol === key)
      th.querySelector('.sort-ind').textContent = sortCol === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    })
  }
  updateHeaders()

  function sort(list) {
    return [...list].sort((a, b) => {
      const va = sortValue(a, sortCol)
      const vb = sortValue(b, sortCol)
      let cmp
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return { ths, sort }
}
