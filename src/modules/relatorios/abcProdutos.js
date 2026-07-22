import { el, mount } from '../../shared/utils/dom.js'
import { brl, toNumero } from '../../shared/utils/formatters.js'
import { subscribeVendas } from '../vendas/service.js'
import { subscribeCompras } from '../compras/service.js'
import { subscribeProdutos } from '../produtos/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { presetRange } from '../../shared/utils/periodo.js'
import { vendasNoPeriodo, indexComprasPorPedido, itensComCusto } from './vendasCalc.js'

const SEM_CATEGORIA = 'Sem categoria'

export function renderAbcProdutos(container) {
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

  let vLoaded = false, cLoaded = false, pLoaded = false
  const tryRender = () => { if (vLoaded && cLoaded && pLoaded) renderScreen(); else update() }

  const unsubVendas = subscribeVendas(list => { vendas = list; vLoaded = true; tryRender() }, onErr)
  const unsubCompras = subscribeCompras(list => { compras = list; cLoaded = true; tryRender() }, onErr)
  const unsubProdutos = subscribeProdutos(list => { produtos = list; pLoaded = true; tryRender() }, onErr)

  return () => { unsubVendas?.(); unsubCompras?.(); unsubProdutos?.() }
}

// O item da venda de pedido guarda o label completo (ex "iPhone 17 · Azul");
// o nome base (antes do " · ") é o nome do produto do catálogo, que carrega a
// categoria. Agrupa variações de cor no mesmo produto, como no relatório
// impresso de referência.
function nomeBase(label) {
  return (label || '').split(' · ')[0].trim()
}

function categoriaDoItem(item, produtosPorId, produtosPorNome) {
  if (item.produtoId && produtosPorId.has(item.produtoId)) {
    return produtosPorId.get(item.produtoId).categoria || SEM_CATEGORIA
  }
  const p = produtosPorNome.get(nomeBase(item.nome).toLowerCase())
  return p?.categoria || SEM_CATEGORIA
}

function buildRelatorio(vendas, compras, produtos, periodo) {
  const comprasPorPedido = indexComprasPorPedido(compras)
  const produtosPorId = new Map(produtos.map(p => [p.id, p]))
  const produtosPorNome = new Map(produtos.map(p => [(p.nome || '').trim().toLowerCase(), p]))

  const vendasMes = vendasNoPeriodo(vendas, periodo.de, periodo.ate)

  // categoria → (nomeBase → { nome, quantidade, venda, custo })
  const porCategoria = new Map()
  vendasMes.forEach(v => {
    itensComCusto(v, comprasPorPedido, produtosPorId).forEach(item => {
      const cat = categoriaDoItem(item, produtosPorId, produtosPorNome)
      const nome = nomeBase(item.nome) || '—'
      if (!porCategoria.has(cat)) porCategoria.set(cat, new Map())
      const prods = porCategoria.get(cat)
      const atual = prods.get(nome) || { nome, quantidade: 0, venda: 0, custo: 0 }
      atual.quantidade += 1
      atual.venda += toNumero(item.venda)
      atual.custo += toNumero(item.custo)
      prods.set(nome, atual)
    })
  })

  let gQtd = 0, gVenda = 0, gCusto = 0

  // Categorias ordenadas por venda total desc (curva ABC).
  const categorias = [...porCategoria.entries()]
    .map(([cat, prodsMap]) => {
      const produtosLista = [...prodsMap.values()].sort((a, b) => b.venda - a.venda)
      const vendaCat = produtosLista.reduce((s, p) => s + p.venda, 0)
      const custoCat = produtosLista.reduce((s, p) => s + p.custo, 0)
      const qtdCat = produtosLista.reduce((s, p) => s + p.quantidade, 0)
      return { cat, produtosLista, vendaCat, custoCat, qtdCat }
    })
    .sort((a, b) => b.vendaCat - a.vendaCat)

  const tbody = document.createElement('tbody')

  categorias.forEach(({ cat, produtosLista, vendaCat, custoCat, qtdCat }) => {
    gQtd += qtdCat; gVenda += vendaCat; gCusto += custoCat

    tbody.appendChild(el('tr', { class: 'dre-row-bloco' },
      el('td', { colspan: '8' }, cat)
    ))

    produtosLista.forEach(p => {
      const lucro = p.venda - p.custo
      const mix = vendaCat > 0 ? (p.venda / vendaCat) * 100 : 0
      const precoMedio = p.quantidade > 0 ? p.venda / p.quantidade : 0
      tbody.appendChild(el('tr', {},
        el('td', { class: 'td-name' }, p.nome),
        el('td', { class: 'td-money' }, String(p.quantidade)),
        el('td', { class: 'td-money' }, brl(precoMedio)),
        el('td', { class: 'td-money' }, brl(p.venda)),
        el('td', { class: 'td-money' }, brl(p.custo)),
        el('td', { class: 'td-money' }, brl(lucro)),
        el('td', { class: 'td-money' }, markupStr(lucro, p.custo)),
        el('td', { class: 'td-money' }, pct(mix)),
      ))
    })

    const lucroCat = vendaCat - custoCat
    tbody.appendChild(el('tr', { class: 'dre-row-subtotal' },
      el('td', {}, `Subtotal ${cat}`),
      el('td', { class: 'td-money' }, String(qtdCat)),
      el('td', { class: 'td-money' }, ''),
      el('td', { class: 'td-money' }, brl(vendaCat)),
      el('td', { class: 'td-money' }, brl(custoCat)),
      el('td', { class: 'td-money' }, brl(lucroCat)),
      el('td', { class: 'td-money' }, markupStr(lucroCat, custoCat)),
      el('td', { class: 'td-money' }, ''),
    ))
  })

  const gLucro = gVenda - gCusto
  const gMargem = gVenda ? (gLucro / gVenda) * 100 : 0

  const kpis = el('div', { class: 'pedidos-stats' },
    kpiCard('Categorias', String(categorias.length), ''),
    kpiCard('Unidades', String(gQtd), ''),
    kpiCard('Venda Total', brl(gVenda), 'green'),
    kpiCard('Lucro Total', brl(gLucro), gLucro >= 0 ? 'green' : 'red'),
    kpiCard('Margem', pct(gMargem), ''),
  )

  if (!categorias.length) {
    return el('div', {}, kpis, el('div', { class: 'empty-state' }, el('p', {}, 'Nenhuma venda no período.')))
  }

  tbody.appendChild(el('tr', { class: 'dre-row-final' },
    el('td', {}, 'TOTAL GERAL'),
    el('td', { class: 'td-money' }, String(gQtd)),
    el('td', { class: 'td-money' }, ''),
    el('td', { class: 'td-money' }, brl(gVenda)),
    el('td', { class: 'td-money' }, brl(gCusto)),
    el('td', { class: 'td-money' }, brl(gLucro)),
    el('td', { class: 'td-money' }, markupStr(gLucro, gCusto)),
    el('td', { class: 'td-money' }, ''),
  ))

  const table = el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table dre-table' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Produto'),
        el('th', { class: 'th-money' }, 'Qtd'),
        el('th', { class: 'th-money' }, 'Preço médio'),
        el('th', { class: 'th-money' }, 'Venda Total'),
        el('th', { class: 'th-money' }, 'Custo Total'),
        el('th', { class: 'th-money' }, 'Lucro'),
        el('th', { class: 'th-money' }, 'Markup %'),
        el('th', { class: 'th-money' }, 'Mix %'),
      )),
      tbody
    )
  )

  return el('div', {}, kpis, table)
}

function pct(v) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// Markup = lucro sobre o custo. Sem custo registrado não há markup calculável.
function markupStr(lucro, custo) {
  return custo > 0 ? pct((lucro / custo) * 100) : '—'
}

function kpiCard(label, value, cls) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: `pedido-stat-value ${cls}` }, value),
  )
}
