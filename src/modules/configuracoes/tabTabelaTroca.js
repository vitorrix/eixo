import { el, mount } from '../../shared/utils/dom.js'
import { saveTabelaTroca } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

// Lista-base da "TABELA BARUK — Troca / Seminovos" — cadastrada uma vez com
// valor 0 (a preencher aqui mesmo); linhas novas (ex: iPhone 18 usado, no
// futuro) entram pelo botão "+ Adicionar modelo" dentro do grupo certo.
export const TABELA_TROCA_PADRAO = [
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '2TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17',         capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17e',        capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17e',        capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    capacidade: '512GB', valor: 0 },

  { linha: 'Apple Watch', modelo: 'Apple Watch Series 4', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 5', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 6', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 7', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 8', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 9', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Ultra 1',  capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Ultra 2',  capacidade: null, valor: 0 },
]

export function renderTabTabelaTroca(container, itensSalvos, onSaved) {
  let itens = (itensSalvos?.length ? itensSalvos : TABELA_TROCA_PADRAO).map(i => ({ ...i }))
  let busca = ''

  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar modelo...' })
  searchInp.addEventListener('input', () => { busca = searchInp.value.trim().toLowerCase(); renderTable() })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Modelo'), el('th', {}, 'Capacidade'), el('th', { class: 'th-money' }, 'Valor de Troca'),
    )),
    tbody,
  )

  function renderTable() {
    tbody.replaceChildren()
    const grupos = [...new Set(itens.map(i => i.linha))]
    grupos.forEach(grupo => {
      const linhas = itens
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.linha === grupo)
        .filter(({ it }) => !busca || it.modelo.toLowerCase().includes(busca) || (it.capacidade || '').toLowerCase().includes(busca))
      if (!linhas.length) return

      tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: '3' }, grupo)))

      linhas.forEach(({ it, idx }) => {
        const valInp = el('input', { type: 'number', class: 'orc-avval-inp', step: '10', style: 'width:110px' })
        valInp.value = it.valor > 0 ? it.valor : ''
        valInp.addEventListener('input', () => { itens[idx].valor = parseFloat(valInp.value) || 0 })

        const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
        delBtn.addEventListener('click', () => { itens.splice(idx, 1); renderTable() })

        tbody.appendChild(el('tr', {},
          el('td', {}, it.modelo),
          el('td', {}, it.capacidade || '—'),
          el('td', { class: 'td-money' },
            el('div', { class: 'orc-pfx-wrap' }, el('span', { class: 'orc-pfx' }, 'R$'), valInp),
            delBtn,
          ),
        ))
      })
    })
  }

  renderTable()

  const addModeloInp = el('input', { type: 'text', placeholder: 'Ex: iPhone 18 Pro Max' })
  const addCapInp    = el('input', { type: 'text', placeholder: 'Capacidade (opcional)' })
  const addLinhaSel  = el('select', { class: 'field-select' },
    ...[...new Set(TABELA_TROCA_PADRAO.map(i => i.linha))].map(l => el('option', { value: l }, l)))
  const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar modelo')
  addBtn.addEventListener('click', () => {
    if (!addModeloInp.value.trim()) { toastError('Digite o nome do modelo.'); return }
    itens.push({ linha: addLinhaSel.value, modelo: addModeloInp.value.trim(), capacidade: addCapInp.value.trim() || null, valor: 0 })
    addModeloInp.value = ''; addCapInp.value = ''
    renderTable()
  })

  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar tabela')
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
    try {
      await saveTabelaTroca(itens)
      onSaved(itens)
      toastSuccess('Tabela de troca salva.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar.')
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar tabela'
    }
  })

  mount(container,
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Tabela de Troca — Seminovos'),
      el('p', { class: 'text-muted', style: 'font-size:13px;margin-bottom:10px' },
        'Valor-base usado na aba Upgrade (Orçamentos) pra avaliar o aparelho do cliente. As avarias são abatidas em cima desse valor.'),
      searchInp,
      el('div', { class: 'table-wrapper' }, table),
      el('div', { class: 'config-list-header', style: 'margin-top:14px' },
        addLinhaSel, addModeloInp, addCapInp, addBtn,
      ),
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
