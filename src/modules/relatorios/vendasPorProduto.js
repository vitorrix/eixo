import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { subscribeVendas } from '../vendas/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { presetRange } from '../../shared/utils/periodo.js'

export function renderVendasPorProduto(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando vendas...'))
  return _init(container)
}

function _init(container) {
  let vendas = []
  let periodo = presetRange('este-mes')
  let firstLoad = true

  const picker = createPeriodoPicker({
    initialPreset: 'este-mes',
    onChange: p => { periodo = p; update() },
  })

  const reportWrap = el('div', {})

  function update() {
    reportWrap.replaceChildren(buildRelatorio(vendas, periodo))
  }

  function renderScreen() {
    mount(container,
      el('div', { class: 'relatorio-toolbar' }, picker.el),
      reportWrap
    )
    update()
  }

  const unsubscribe = subscribeVendas(
    list => {
      vendas = list
      if (firstLoad) {
        firstLoad = false
        renderScreen()
      } else {
        update()
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar vendas.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}

function dataVenda(v) {
  return v.criadoEm?.toDate ? v.criadoEm.toDate().toISOString().slice(0, 10) : null
}

function vendasNoPeriodo(vendas, de, ate) {
  return vendas.filter(v => {
    const d = dataVenda(v)
    return d && d >= de && d <= ate
  })
}

// Venda de pedido tem itens[] (um por aparelho/serviço do pedido); venda
// avulsa é sempre 1 produto só. Nos dois casos cada linha vira 1 unidade —
// não existe campo de quantidade, cada item já representa 1 aparelho.
function agruparPorProduto(vendasMes) {
  const mapa = new Map()
  function soma(nome, valor) {
    nome = (nome || '').trim()
    if (!nome) return
    const atual = mapa.get(nome) || { nome, quantidade: 0, valor: 0 }
    atual.quantidade += 1
    atual.valor += valor || 0
    mapa.set(nome, atual)
  }
  vendasMes.forEach(v => {
    if (Array.isArray(v.itens) && v.itens.length) {
      v.itens.forEach(it => soma(it.produto, it.valor))
    } else {
      soma(v.produto, v.valorVenda)
    }
  })
  return [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor)
}

function buildRelatorio(vendas, periodo) {
  const vendasMes = vendasNoPeriodo(vendas, periodo.de, periodo.ate)
  const ranking = agruparPorProduto(vendasMes)

  const totalUnidades = ranking.reduce((s, r) => s + r.quantidade, 0)
  const totalValor = ranking.reduce((s, r) => s + r.valor, 0)

  const kpis = el('div', { class: 'pedidos-stats' },
    kpiCard('Produtos distintos', ranking.length),
    kpiCard('Unidades vendidas', totalUnidades),
    kpiCard('Valor total vendido', brl(totalValor)),
  )

  if (!ranking.length) {
    return el('div', {}, kpis, el('div', { class: 'empty-state' }, el('p', {}, 'Nenhuma venda neste mês.')))
  }

  const tbody = document.createElement('tbody')
  ranking.forEach((r, i) => {
    tbody.appendChild(el('tr', {},
      el('td', { class: 'td-date' }, String(i + 1)),
      el('td', { class: 'td-name' }, r.nome),
      el('td', { class: 'td-money' }, String(r.quantidade)),
      el('td', { class: 'td-money' }, brl(r.valor)),
    ))
  })
  const table = el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table' },
      el('thead', {},
        el('tr', {},
          el('th', {}, '#'),
          el('th', {}, 'Produto'),
          el('th', { class: 'th-money' }, 'Qtd. vendida'),
          el('th', { class: 'th-money' }, 'Valor total'),
        )
      ),
      tbody
    )
  )

  return el('div', {}, kpis, table)
}

function kpiCard(label, value) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: 'pedido-stat-value' }, String(value)),
  )
}
