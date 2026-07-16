import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { nowMonth, monthLabel, shiftMonth } from '../../shared/utils/month.js'
import { getOperacoes } from '../configuracoes/service.js'
import { GRUPOS_DRE } from '../configuracoes/tabCategorias.js'
import { subscribeFinanceiro } from '../financeiro/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { lancamentosDoMes, somaCategoria, categoriasDoGrupo } from './financeiroCalc.js'

export function renderFluxoFinanceiro(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando fluxo financeiro...'))
  return _init(container)
}

async function _init(container) {
  let operacoes = { categorias: [] }
  try {
    operacoes = await getOperacoes()
  } catch (err) {
    console.error(err)
    mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar categorias.'))
    toastError('Falha ao carregar configurações.')
    return
  }

  let lancamentos = []
  let currentMonth = nowMonth()
  let firstLoad = true

  const monthNavLabel = el('span', { class: 'month-nav-label' })
  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); update() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); update() })

  const reportWrap = el('div', {})

  function update() {
    monthNavLabel.textContent = monthLabel(currentMonth)
    reportWrap.replaceChildren(buildFluxo(lancamentos, operacoes.categorias || [], currentMonth))
  }

  function renderScreen() {
    mount(container,
      el('div', { class: 'relatorio-toolbar' },
        el('div', { class: 'month-nav' }, prevBtn, monthNavLabel, nextBtn)
      ),
      reportWrap
    )
    update()
  }

  const unsubscribe = subscribeFinanceiro(
    list => {
      lancamentos = list
      if (firstLoad) {
        firstLoad = false
        renderScreen()
      } else {
        update()
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar lançamentos.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}

// Monta uma coluna (Despesas ou Receitas) percorrendo os grupos do DRE na
// ordem fixa e listando só as categorias daquele tipo — grupo/subgrupo sem
// nenhuma categoria com valor nesse tipo no mês nem aparece, pra não deixar
// cabeçalho vazio (ex: "Receita Bruta" nunca aparece do lado de Despesas).
function buildColuna(lancamentosMes, categorias, tipo, titulo) {
  const tbody = document.createElement('tbody')
  let total = 0

  function addCategorias(grupo, subgrupo) {
    categoriasDoGrupo(categorias, grupo, subgrupo)
      .filter(c => c.tipo === tipo)
      .forEach(c => {
        const v = somaCategoria(lancamentosMes, c)
        if (!v) return
        total += v
        tbody.appendChild(el('tr', { class: 'dre-row-indent' },
          el('td', {}, c.nome),
          el('td', { class: 'td-money' }, brl(v))
        ))
      })
  }

  GRUPOS_DRE.forEach(g => {
    if (g.subgrupos) {
      let cabecalhoGrupo = false
      g.subgrupos.forEach(sg => {
        const cats = categoriasDoGrupo(categorias, g.grupo, sg).filter(c => c.tipo === tipo)
        const somaSub = cats.reduce((s, c) => s + somaCategoria(lancamentosMes, c), 0)
        if (!somaSub) return
        if (!cabecalhoGrupo) {
          tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: '2' }, g.grupo)))
          cabecalhoGrupo = true
        }
        tbody.appendChild(el('tr', { class: 'dre-row-subgrupo' }, el('td', { colspan: '2' }, sg)))
        addCategorias(g.grupo, sg)
      })
      return
    }
    const cats = categoriasDoGrupo(categorias, g.grupo).filter(c => c.tipo === tipo)
    const somaGrupo = cats.reduce((s, c) => s + somaCategoria(lancamentosMes, c), 0)
    if (!somaGrupo) return
    tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: '2' }, g.grupo)))
    addCategorias(g.grupo)
  })

  tbody.appendChild(el('tr', { class: 'dre-row-final' },
    el('td', {}, `TOTAL ${titulo.toUpperCase()}`),
    el('td', { class: 'td-money' }, brl(total))
  ))

  return { el: el('div', { class: 'table-wrapper' }, el('table', { class: 'data-table dre-table' }, tbody)), total }
}

function buildFluxo(lancamentos, categorias, mes) {
  const lancamentosMes = lancamentosDoMes(lancamentos, mes)

  const despesas = buildColuna(lancamentosMes, categorias, 'pagar', 'Despesas')
  const receitas = buildColuna(lancamentosMes, categorias, 'receber', 'Receitas')
  const saldo = receitas.total - despesas.total

  const kpis = el('div', { class: 'pedidos-stats' },
    kpiCard('Total Receitas', brl(receitas.total), 'green'),
    kpiCard('Total Despesas', brl(despesas.total), 'red'),
    kpiCard('Saldo do Período', brl(saldo), saldo >= 0 ? 'green' : 'red'),
  )

  const colunas = el('div', { class: 'relatorio-duas-colunas' }, despesas.el, receitas.el)

  return el('div', {}, kpis, colunas)
}

function kpiCard(label, value, cls) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: `pedido-stat-value ${cls}` }, value),
  )
}
