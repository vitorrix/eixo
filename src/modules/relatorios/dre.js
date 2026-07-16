import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { nowMonth, monthKey, monthLabel, shiftMonth } from '../../shared/utils/month.js'
import { getOperacoes } from '../configuracoes/service.js'
import { GRUPOS_DRE } from '../configuracoes/tabCategorias.js'
import { subscribeFinanceiro } from '../financeiro/service.js'
import { toastError } from '../../shared/components/Toast.js'

export function renderDRE(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando DRE...'))
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
    reportWrap.replaceChildren(buildDRE(lancamentos, operacoes.categorias || [], currentMonth))
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

// ── Cálculo do DRE ──────────────────────────────────────────────────────────
// Regime de caixa: só entra o que já foi liquidado (recebido/pago de fato) no
// mês selecionado, pela data de liquidação — não pela data de vencimento.
function lancamentosDoMes(lancamentos, mes) {
  return lancamentos.filter(l => l.liquidado && monthKey(l.dataLiquidacao) === mes)
}

function somaCategoria(lancamentosMes, categoria) {
  return lancamentosMes
    .filter(l => l.categoria === categoria.nome && l.tipo === categoria.tipo)
    .reduce((s, l) => s + (l.valor || 0), 0)
}

function categoriasDoGrupo(categorias, grupo, subgrupo) {
  return categorias.filter(c => c.grupo === grupo && (subgrupo ? c.subgrupo === subgrupo : true))
}

// Soma de todas as categorias de um grupo (ou de um subgrupo específico
// dentro de Despesas Operacionais), ignorando o sinal — quem decide se soma
// ou subtrai é quem chama, conforme a posição do grupo no DRE.
function totalGrupo(lancamentosMes, categorias, grupo, subgrupo) {
  return categoriasDoGrupo(categorias, grupo, subgrupo)
    .reduce((s, c) => s + somaCategoria(lancamentosMes, c), 0)
}

function buildDRE(lancamentos, categorias, mes) {
  const lancamentosMes = lancamentosDoMes(lancamentos, mes)

  const receitaBruta = totalGrupo(lancamentosMes, categorias, 'Receita Bruta')
  const impostos = totalGrupo(lancamentosMes, categorias, 'Impostos')
  const receitaLiquida = receitaBruta - impostos

  const cmv = totalGrupo(lancamentosMes, categorias, 'Custo dos Produtos Vendidos (CMV)')
  const lucroBruto = receitaLiquida - cmv

  const grupoDespOp = GRUPOS_DRE.find(g => g.grupo === 'Despesas Operacionais')
  const subgruposDespOp = grupoDespOp?.subgrupos || []
  const totaisSubgrupo = subgruposDespOp.map(sg => ({
    subgrupo: sg,
    total: totalGrupo(lancamentosMes, categorias, 'Despesas Operacionais', sg),
  }))
  const totalDespOperacionais = totaisSubgrupo.reduce((s, x) => s + x.total, 0)

  const totalDespVendas = totalGrupo(lancamentosMes, categorias, 'Despesas de Vendas')

  const lucroOperacional = lucroBruto - totalDespOperacionais - totalDespVendas

  // Resultado Financeiro fica fora do operacional — soma com sinal: entrada
  // (tipo receber) soma, saída (tipo pagar, ex: parcela de empréstimo) subtrai.
  const categoriasResultadoFin = categoriasDoGrupo(categorias, 'Resultado Financeiro')
  const totalResultadoFinanceiro = categoriasResultadoFin.reduce((s, c) => {
    const v = somaCategoria(lancamentosMes, c)
    return s + (c.tipo === 'receber' ? v : -v)
  }, 0)

  const resultadoLiquido = lucroOperacional + totalResultadoFinanceiro

  const margemBruta = receitaLiquida ? lucroBruto / receitaLiquida : 0
  const margemOperacional = receitaLiquida ? lucroOperacional / receitaLiquida : 0
  const margemLiquida = receitaLiquida ? resultadoLiquido / receitaLiquida : 0

  // ── Montagem das linhas da tabela ─────────────────────────────────────────
  const tbody = document.createElement('tbody')

  function addBlocoHeader(label) {
    tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: '2' }, label)))
  }
  function addCategorias(grupo, subgrupo) {
    categoriasDoGrupo(categorias, grupo, subgrupo).forEach(c => {
      const v = somaCategoria(lancamentosMes, c)
      if (!v) return
      tbody.appendChild(el('tr', { class: 'dre-row-indent' },
        el('td', {}, c.nome),
        el('td', { class: 'td-money' }, brl(v))
      ))
    })
  }
  function addTotal(label, valor, cls = 'dre-row-subtotal') {
    tbody.appendChild(el('tr', { class: cls },
      el('td', {}, label),
      el('td', { class: 'td-money' }, brl(valor))
    ))
  }

  addBlocoHeader('(+) Receita Bruta')
  addCategorias('Receita Bruta')
  addBlocoHeader('(-) Impostos')
  addCategorias('Impostos')
  addTotal('(=) RECEITA LÍQUIDA', receitaLiquida, 'dre-row-total')

  addBlocoHeader('(-) Custo dos Produtos Vendidos (CMV)')
  addCategorias('Custo dos Produtos Vendidos (CMV)')
  addTotal('(=) LUCRO BRUTO', lucroBruto, 'dre-row-total')

  addBlocoHeader('Despesas Operacionais')
  totaisSubgrupo.forEach(({ subgrupo, total }) => {
    tbody.appendChild(el('tr', { class: 'dre-row-subgrupo' }, el('td', { colspan: '2' }, subgrupo)))
    addCategorias('Despesas Operacionais', subgrupo)
    addTotal(`Subtotal ${subgrupo}`, total)
  })
  addTotal('(-) TOTAL DESPESAS OPERACIONAIS', totalDespOperacionais, 'dre-row-subtotal')

  addBlocoHeader('Despesas de Vendas')
  addCategorias('Despesas de Vendas')
  addTotal('(-) TOTAL DESPESAS DE VENDAS', totalDespVendas)

  addTotal('(=) LUCRO OPERACIONAL', lucroOperacional, 'dre-row-final')

  addBlocoHeader('Resultado Financeiro (separado do operacional)')
  addCategorias('Resultado Financeiro')
  addTotal('(-/+) TOTAL RESULTADO FINANCEIRO', totalResultadoFinanceiro)

  addTotal('(=) RESULTADO LÍQUIDO', resultadoLiquido, 'dre-row-final')

  const table = el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table dre-table' }, tbody)
  )

  const indicadores = el('div', { class: 'pedidos-stats' },
    indicadorCard('Margem Bruta', margemBruta),
    indicadorCard('Margem Operacional', margemOperacional),
    indicadorCard('Margem Líquida', margemLiquida),
  )

  return el('div', {}, table, indicadores)
}

function indicadorCard(label, fracao) {
  const pct = (fracao * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: 'pedido-stat-value' }, `${pct}%`),
  )
}
