import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { nowMonth, monthLabel, shiftMonth } from '../../shared/utils/month.js'
import { getOperacoes } from '../configuracoes/service.js'
import { GRUPOS_DRE } from '../configuracoes/tabCategorias.js'
import { subscribeFinanceiro } from '../financeiro/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { lancamentosDoMes, somaCategoria, categoriasDoGrupo } from './financeiroCalc.js'

// Trava de segurança pra não gerar uma tabela absurdamente larga se o usuário
// escolher um intervalo enorme por engano.
const MAX_MESES = 36

export function renderFluxoCaixaPeriodico(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando fluxo de caixa...'))
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
  let mesDe = shiftMonth(nowMonth(), -5)
  let mesAte = nowMonth()
  let firstLoad = true

  const deInp = el('input', { type: 'month', value: mesDe })
  const ateInp = el('input', { type: 'month', value: mesAte })
  deInp.addEventListener('change', () => { if (deInp.value) { mesDe = deInp.value; update() } })
  ateInp.addEventListener('change', () => { if (ateInp.value) { mesAte = ateInp.value; update() } })

  const reportWrap = el('div', {})

  function update() {
    reportWrap.replaceChildren(buildFluxoPeriodico(lancamentos, operacoes.categorias || [], mesDe, mesAte))
  }

  function renderScreen() {
    mount(container,
      el('div', { class: 'relatorio-toolbar relatorio-periodo-picker' },
        el('div', { class: 'field' }, el('label', {}, 'De'), deInp),
        el('div', { class: 'field' }, el('label', {}, 'Até'), ateInp),
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

function mesesNoIntervalo(de, ate) {
  const meses = []
  let cursor = de <= ate ? de : ate
  const fim = de <= ate ? ate : de
  while (cursor <= fim && meses.length < MAX_MESES) {
    meses.push(cursor)
    cursor = shiftMonth(cursor, 1)
  }
  return meses
}

// Saldo de tudo que já foi liquidado antes do primeiro mês do período —
// ponto de partida do saldo acumulado (mesma lógica do "Saldo Anterior" do
// eGestor).
function saldoAntesDe(lancamentos, primeiroMes) {
  return lancamentos
    .filter(l => l.liquidado && (l.dataLiquidacao || '') < `${primeiroMes}-01`)
    .reduce((s, l) => s + (l.tipo === 'receber' ? (l.valor || 0) : -(l.valor || 0)), 0)
}

function totalTipoNoMes(lancamentosMes, categorias, tipo) {
  return categorias
    .filter(c => c.tipo === tipo)
    .reduce((s, c) => s + somaCategoria(lancamentosMes, c), 0)
}

// Monta o bloco de linhas (Despesas ou Receitas) da matriz — uma linha por
// categoria, uma coluna por mês. Só entra categoria com pelo menos 1 mês
// diferente de zero no período; grupo/subgrupo vazio em todos os meses some.
function buildBlocoMatriz(mesesLancamentos, categorias, tipo, titulo) {
  const tbody = document.createElement('tbody')

  function addCategoriaLinha(categoria) {
    const valores = mesesLancamentos.map(lm => somaCategoria(lm, categoria))
    if (!valores.some(Boolean)) return
    tbody.appendChild(el('tr', { class: 'dre-row-indent' },
      el('td', {}, categoria.nome),
      ...valores.map(v => el('td', { class: 'td-money' }, brl(v))),
    ))
  }

  GRUPOS_DRE.forEach(g => {
    if (g.subgrupos) {
      let cabecalhoGrupo = false
      g.subgrupos.forEach(sg => {
        const cats = categoriasDoGrupo(categorias, g.grupo, sg).filter(c => c.tipo === tipo)
        if (!cats.length) return
        const temValor = cats.some(c => mesesLancamentos.some(lm => somaCategoria(lm, c)))
        if (!temValor) return
        if (!cabecalhoGrupo) {
          tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: String(mesesLancamentos.length + 1) }, g.grupo)))
          cabecalhoGrupo = true
        }
        tbody.appendChild(el('tr', { class: 'dre-row-subgrupo' }, el('td', { colspan: String(mesesLancamentos.length + 1) }, sg)))
        cats.forEach(addCategoriaLinha)
      })
      return
    }
    const cats = categoriasDoGrupo(categorias, g.grupo).filter(c => c.tipo === tipo)
    if (!cats.length) return
    const temValor = cats.some(c => mesesLancamentos.some(lm => somaCategoria(lm, c)))
    if (!temValor) return
    tbody.appendChild(el('tr', { class: 'dre-row-bloco' }, el('td', { colspan: String(mesesLancamentos.length + 1) }, g.grupo)))
    cats.forEach(addCategoriaLinha)
  })

  const totaisPorMes = mesesLancamentos.map(lm => totalTipoNoMes(lm, categorias, tipo))
  tbody.appendChild(el('tr', { class: 'dre-row-subtotal' },
    el('td', {}, `TOTAL ${titulo.toUpperCase()}`),
    ...totaisPorMes.map(v => el('td', { class: 'td-money' }, brl(v))),
  ))

  return { tbody, totaisPorMes }
}

function buildFluxoPeriodico(lancamentos, categorias, mesDeParam, mesAteParam) {
  const meses = mesesNoIntervalo(mesDeParam, mesAteParam)
  const mesesLancamentos = meses.map(m => lancamentosDoMes(lancamentos, m))

  const tbody = document.createElement('tbody')
  const thead = el('thead', {},
    el('tr', {},
      el('th', {}, 'Categoria'),
      ...meses.map(m => el('th', { class: 'th-money' }, monthLabel(m))),
    )
  )

  const despesas = buildBlocoMatriz(mesesLancamentos, categorias, 'pagar', 'Despesas')
  const receitas = buildBlocoMatriz(mesesLancamentos, categorias, 'receber', 'Receitas')
  despesas.tbody.querySelectorAll('tr').forEach(tr => tbody.appendChild(tr))
  receitas.tbody.querySelectorAll('tr').forEach(tr => tbody.appendChild(tr))

  const saldoDoMes = meses.map((_, i) => receitas.totaisPorMes[i] - despesas.totaisPorMes[i])
  let acumulado = saldoAntesDe(lancamentos, meses[0])
  const saldoAcumulado = saldoDoMes.map(s => (acumulado += s))

  tbody.appendChild(el('tr', { class: 'dre-row-total' },
    el('td', {}, 'SALDO DO MÊS'),
    ...saldoDoMes.map(v => el('td', { class: 'td-money' }, brl(v))),
  ))
  tbody.appendChild(el('tr', { class: 'dre-row-final' },
    el('td', {}, 'SALDO ACUMULADO'),
    ...saldoAcumulado.map(v => el('td', { class: 'td-money' }, brl(v))),
  ))

  return el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table dre-table' }, thead, tbody)
  )
}
