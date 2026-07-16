import { el, mount } from '../../shared/utils/dom.js'
import { brl, fullDate } from '../../shared/utils/formatters.js'
import { subscribeVendas } from '../vendas/service.js'
import { subscribeCompras } from '../compras/service.js'
import { subscribeProdutos } from '../produtos/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { presetRange } from '../../shared/utils/periodo.js'

const PAG_LABEL = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', link: 'Link' }

export function renderVendasDetalhadas(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando vendas...'))
  return _init(container)
}

function _init(container) {
  let vendas = []
  let compras = []
  let produtos = []
  let periodo = presetRange('este-mes')
  let rendered = false

  const picker = createPeriodoPicker({
    initialPreset: 'este-mes',
    onChange: p => { periodo = p; update() },
  })

  const reportWrap = el('div', {})

  function update() {
    if (!rendered) return
    reportWrap.replaceChildren(buildRelatorio(vendas, compras, produtos, periodo))
  }

  function renderScreen() {
    if (rendered) return
    rendered = true
    mount(container,
      el('div', { class: 'relatorio-toolbar' }, picker.el),
      reportWrap
    )
    update()
  }

  const onErr = err => {
    console.error(err)
    mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar dados.'))
    toastError('Falha na conexão com o banco de dados.')
  }

  // Três coleções em tempo real: vendas é a base; compras dão o custo real por
  // item das vendas de pedido; produtos dão o custo (best-effort) das avulsas.
  // Só renderiza depois que a primeira leva das três chegou, pra não mostrar
  // custo zerado antes das compras carregarem.
  let vLoaded = false, cLoaded = false, pLoaded = false
  const tryRender = () => { if (vLoaded && cLoaded && pLoaded) renderScreen(); else update() }

  const unsubVendas = subscribeVendas(list => { vendas = list; vLoaded = true; tryRender() }, onErr)
  const unsubCompras = subscribeCompras(list => { compras = list; cLoaded = true; tryRender() }, onErr)
  const unsubProdutos = subscribeProdutos(list => { produtos = list; pLoaded = true; tryRender() }, onErr)

  return () => { unsubVendas?.(); unsubCompras?.(); unsubProdutos?.() }
}

function dataVenda(v) {
  return v.criadoEm?.toDate ? v.criadoEm.toDate().toISOString().slice(0, 10) : null
}

// Casa cada item da venda de pedido com uma Compra do mesmo pedido pelo nome
// do produto, consumindo a compra usada — cobre o caso de 2 unidades do mesmo
// produto no pedido (cada uma tem sua Compra). Item sem compra correspondente
// (ex: acessório lançado sem custo) fica com custo 0.
function itensComCusto(venda, comprasPorPedido, produtosPorId) {
  if (venda.pedidoId) {
    const disponiveis = [...(comprasPorPedido.get(venda.pedidoId) || [])]
    return (venda.itens || []).map(it => {
      const idx = disponiveis.findIndex(c => c.produto === it.produto)
      let custo = 0
      if (idx >= 0) { custo = disponiveis[idx].custo || 0; disponiveis.splice(idx, 1) }
      return { nome: it.produto, custo, venda: it.valor || 0 }
    })
  }
  // Venda avulsa: item único, custo puxado do cadastro do produto.
  const custo = venda.produtoId ? (produtosPorId.get(venda.produtoId)?.precoCusto || 0) : 0
  return [{ nome: venda.produto || '—', custo, venda: venda.valorVenda || 0 }]
}

function buildRelatorio(vendas, compras, produtos, periodo) {
  const comprasPorPedido = new Map()
  compras.forEach(c => {
    if (!c.pedidoId) return
    if (!comprasPorPedido.has(c.pedidoId)) comprasPorPedido.set(c.pedidoId, [])
    comprasPorPedido.get(c.pedidoId).push(c)
  })
  const produtosPorId = new Map(produtos.map(p => [p.id, p]))

  const vendasMes = vendas
    .filter(v => { const d = dataVenda(v); return d && d >= periodo.de && d <= periodo.ate })
    .sort((a, b) => (dataVenda(a) || '').localeCompare(dataVenda(b) || ''))

  let totUnidades = 0, totCusto = 0, totVenda = 0
  const cards = []

  vendasMes.forEach(v => {
    const itens = itensComCusto(v, comprasPorPedido, produtosPorId)
    const custoVenda = itens.reduce((s, it) => s + it.custo, 0)
    const valorVenda = itens.reduce((s, it) => s + it.venda, 0)
    const lucroVenda = valorVenda - custoVenda
    totUnidades += itens.length
    totCusto += custoVenda
    totVenda += valorVenda

    const tbody = document.createElement('tbody')
    itens.forEach(it => {
      tbody.appendChild(el('tr', {},
        el('td', { class: 'td-name' }, it.nome),
        el('td', { class: 'td-money' }, brl(it.custo)),
        el('td', { class: 'td-money' }, brl(it.venda)),
        el('td', { class: 'td-money' }, brl(it.venda - it.custo)),
      ))
    })
    tbody.appendChild(el('tr', { class: 'dre-row-total' },
      el('td', {}, 'Total da venda'),
      el('td', { class: 'td-money' }, brl(custoVenda)),
      el('td', { class: 'td-money' }, brl(valorVenda)),
      el('td', { class: 'td-money' }, brl(lucroVenda)),
    ))

    const pag = PAG_LABEL[v.formaPagamento] || v.formaPagamento || '—'
    cards.push(el('div', { class: 'venda-det-card' },
      el('div', { class: 'venda-det-head' },
        el('span', { class: 'venda-det-cliente' }, v.cliente || '—'),
        el('span', { class: 'venda-det-meta' }, `${fullDate(dataVenda(v))} · ${pag}`),
      ),
      el('div', { class: 'table-wrapper' },
        el('table', { class: 'data-table venda-det-table' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Produto'),
            el('th', { class: 'th-money' }, 'Custo'),
            el('th', { class: 'th-money' }, 'Venda'),
            el('th', { class: 'th-money' }, 'Lucro'),
          )),
          tbody
        )
      )
    ))
  })

  const totLucro = totVenda - totCusto
  const margem = totVenda ? (totLucro / totVenda) * 100 : 0

  const kpis = el('div', { class: 'pedidos-stats' },
    kpiCard('Vendas', String(vendasMes.length), ''),
    kpiCard('Venda Total', brl(totVenda), 'green'),
    kpiCard('Custo Total', brl(totCusto), ''),
    kpiCard('Lucro Total', brl(totLucro), totLucro >= 0 ? 'green' : 'red'),
    kpiCard('Margem', `${margem.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, ''),
  )

  if (!vendasMes.length) {
    return el('div', {}, kpis, el('div', { class: 'empty-state' }, el('p', {}, 'Nenhuma venda no período.')))
  }

  // Total geral do período — mesmo fechamento do rodapé do relatório impresso.
  const totalGeral = el('div', { class: 'table-wrapper venda-det-total-geral' },
    el('table', { class: 'data-table venda-det-table' },
      el('tbody', {},
        el('tr', { class: 'dre-row-final' },
          el('td', {}, `TOTAL GERAL (${vendasMes.length} ${vendasMes.length === 1 ? 'venda' : 'vendas'}, ${totUnidades} ${totUnidades === 1 ? 'item' : 'itens'})`),
          el('td', { class: 'td-money' }, brl(totCusto)),
          el('td', { class: 'td-money' }, brl(totVenda)),
          el('td', { class: 'td-money' }, brl(totLucro)),
        )
      )
    )
  )

  return el('div', {}, kpis, el('div', { class: 'venda-det-list' }, ...cards), totalGeral)
}

function kpiCard(label, value, cls) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: `pedido-stat-value ${cls}` }, value),
  )
}
