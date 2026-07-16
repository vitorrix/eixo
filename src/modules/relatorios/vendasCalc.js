// Cálculos compartilhados dos relatórios baseados em Vendas (Vendas
// Detalhadas, ABC de Produtos). O custo por item não vive na Venda: venda de
// pedido guarda o custo na Compra vinculada (pedidoId), venda avulsa no
// cadastro do produto (produtoId → precoCusto).

export function dataVenda(v) {
  return v.criadoEm?.toDate ? v.criadoEm.toDate().toISOString().slice(0, 10) : null
}

export function vendasNoPeriodo(vendas, de, ate) {
  return vendas
    .filter(v => { const d = dataVenda(v); return d && d >= de && d <= ate })
    .sort((a, b) => (dataVenda(a) || '').localeCompare(dataVenda(b) || ''))
}

export function indexComprasPorPedido(compras) {
  const map = new Map()
  compras.forEach(c => {
    if (!c.pedidoId) return
    if (!map.has(c.pedidoId)) map.set(c.pedidoId, [])
    map.get(c.pedidoId).push(c)
  })
  return map
}

// Casa cada item da venda de pedido com uma Compra do mesmo pedido pelo nome
// do produto, consumindo a compra usada — cobre o caso de 2 unidades do mesmo
// produto no pedido (cada uma tem sua Compra). Item sem compra correspondente
// (ex: acessório lançado sem custo) fica com custo 0. Venda avulsa é item
// único, custo puxado do cadastro do produto.
export function itensComCusto(venda, comprasPorPedido, produtosPorId) {
  if (venda.pedidoId) {
    const disponiveis = [...(comprasPorPedido.get(venda.pedidoId) || [])]
    return (venda.itens || []).map(it => {
      const idx = disponiveis.findIndex(c => c.produto === it.produto)
      let custo = 0
      if (idx >= 0) { custo = disponiveis[idx].custo || 0; disponiveis.splice(idx, 1) }
      return { nome: it.produto, custo, venda: it.valor || 0, produtoId: null }
    })
  }
  const custo = venda.produtoId ? (produtosPorId.get(venda.produtoId)?.precoCusto || 0) : 0
  return [{ nome: venda.produto || '—', custo, venda: venda.valorVenda || 0, produtoId: venda.produtoId || null }]
}
