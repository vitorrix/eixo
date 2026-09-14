import { el, mount } from '../../shared/utils/dom.js'
import { saveTabelaTroca } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

// Lista-base da "TABELA BARUK — Troca / Seminovos" — 1 valor por aparelho,
// sem quebrar por capacidade (o Vitor só precisa do modelo: "iPhone 17 Pro
// Max", não "256GB"/"512GB"/... separado). Cadastrada uma vez com valor 0
// (a preencher aqui mesmo); linhas novas entram pelo botão "+ Adicionar
// modelo" dentro do grupo certo.
export const TABELA_TROCA_PADRAO = [
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17',         valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17e',        valor: 0 },

  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        valor: 0 },

  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         valor: 0 },

  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         valor: 0 },

  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    valor: 0 },

  { linha: 'Apple Watch', modelo: 'Apple Watch Series 4', valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 5', valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 6', valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 7', valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 8', valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 9', valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Ultra 1',  valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Ultra 2',  valor: 0 },
]

// Colapsa registros antigos (de quando a tabela ainda tinha 1 linha por
// capacidade) em 1 só por modelo — mantém o maior valor já preenchido entre
// as capacidades duplicadas, pra não perder o que já tinha sido salvo.
function colapsarPorModelo(lista) {
  const porModelo = new Map()
  lista.forEach(it => {
    const chave = `${it.linha}|${it.modelo}`
    const atual = porModelo.get(chave)
    const valor = Number(it.valor) || 0
    if (!atual || valor > atual.valor) porModelo.set(chave, { linha: it.linha, modelo: it.modelo, valor })
  })
  return [...porModelo.values()]
}

export function renderTabTabelaTroca(container, itensSalvos, onSaved) {
  let itens = colapsarPorModelo(itensSalvos?.length ? itensSalvos : TABELA_TROCA_PADRAO)
  let busca = ''

  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar modelo...' })
  searchInp.addEventListener('input', () => { busca = searchInp.value.trim().toLowerCase(); renderTable() })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Modelo'), el('th', { class: 'th-money' }, 'Valor de Troca'),
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
        .filter(({ it }) => !busca || it.modelo.toLowerCase().includes(busca))
      if (!linhas.length) return

      tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: '2' }, grupo)))

      linhas.forEach(({ it, idx }) => {
        // orc-input + orc-inp-money: mesmo padrão dos campos de dinheiro do
        // Orçamento — antes usava orc-avval-inp (feito pra avaria, vermelho
        // e com padding pensado pra outro prefixo), que deixava o "R$"
        // encavalado no número.
        const valInp = el('input', { type: 'number', class: 'orc-input orc-inp-money', step: '10' })
        valInp.value = it.valor > 0 ? it.valor : ''
        valInp.addEventListener('input', () => { itens[idx].valor = parseFloat(valInp.value) || 0 })

        const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
        delBtn.addEventListener('click', () => { itens.splice(idx, 1); renderTable() })

        tbody.appendChild(el('tr', {},
          el('td', {}, it.modelo),
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
  const addLinhaSel  = el('select', { class: 'field-select' },
    ...[...new Set(TABELA_TROCA_PADRAO.map(i => i.linha))].map(l => el('option', { value: l }, l)))
  const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar modelo')
  addBtn.addEventListener('click', () => {
    if (!addModeloInp.value.trim()) { toastError('Digite o nome do modelo.'); return }
    itens.push({ linha: addLinhaSel.value, modelo: addModeloInp.value.trim(), valor: 0 })
    addModeloInp.value = ''
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
        addLinhaSel, addModeloInp, addBtn,
      ),
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
