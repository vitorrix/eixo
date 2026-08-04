import {
  collection, addDoc, updateDoc, deleteDoc, deleteField,
  doc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getOperacoes, proximoNumeroFinanceiro } from '../configuracoes/service.js'
import { isoLocal } from '../../shared/utils/periodo.js'

const COL = 'compras'

// Gera o Pagamento no Financeiro de uma Compra lançada direto neste menu (sem
// vir de Pedido) — mesma lógica do Pedido (criarCompraEVenda), só que sem
// pedidoId na origem. Compra lançada aqui já é uma compra fechada (não existe
// "aguardando" nesse formulário), então o pagamento já nasce liquidado, com
// vencimento/liquidação hoje. Sem forma de pagamento escolhida ou custo zerado
// (brinde/erro), não lança nada.
async function gerarPagamentoCompra(compraId, { custo, produto, fornecedor, cliente, formaPagamento }) {
  if (!(custo > 0) || !formaPagamento) return null
  const operacoes = await getOperacoes()
  const categoriaPagar = operacoes.categorias?.find(c => c.tipo === 'pagar' && c.grupo === 'Custo dos Produtos Vendidos (CMV)')?.nome
  const conta = operacoes.formasPagamento?.find(f => f.nome === formaPagamento)?.contaPadrao || ''
  const hoje = isoLocal(new Date())
  const numero = await proximoNumeroFinanceiro()
  return {
    numero, tipo: 'pagar',
    descricao:       `Compra: ${produto}`,
    valor:           custo,
    contato:         fornecedor || cliente || '',
    categoria:       categoriaPagar,
    conta,
    formaPagamento,
    liquidado:       true,
    dataVencimento:  hoje,
    dataLiquidacao:  hoje,
    numeroDocumento: '',
    observacoes:     '',
    parcela:         { numero: 1, total: 1 },
    origem:          { tipo: 'compra', id: compraId },
    recorrencia:     null,
    criadoEm:        serverTimestamp(),
  }
}

export function subscribeCompras(callback, onError) {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

// "Estoque" é o único status que significa "unidade disponível pra vender" —
// Aguardando (ainda não chegou) e Concluído (já foi embora) não somam estoque.
const STATUS_EM_ESTOQUE = 'estoque'

// Se a compra já nasce em "estoque", já soma de cara — mesma regra usada
// quando o status muda depois via atualizarStatusCompra. Compra lançada aqui
// (avulsa, ex: aparelho comprado direto de um cliente) já nasce em estoque por
// padrão; só vira Aguardando/Concluído quando gerada pelo fluxo de Pedidos.
// "quantidade" (default 1) é pra lançamento em lote (ex: acessório comprado
// em quantidade) — "custo" continua sendo o total da linha, não o unitário.
export async function createCompra(data) {
  const status = data.status || STATUS_EM_ESTOQUE
  const quantidade = parseInt(data.quantidade) || 1
  const jaRecebida = status === STATUS_EM_ESTOQUE && data.produtoId

  const batch = writeBatch(db)
  const ref = doc(collection(db, COL))
  batch.set(ref, {
    produtoId:       data.produtoId || null,
    produto:         (data.produto      || '').trim(),
    fornecedor:      (data.fornecedor   || '').trim(),
    custo:           parseFloat(data.custo) || 0,
    quantidade,
    status,
    observacoes:     (data.observacoes || '').trim(), // dados do aparelho — mesmos que vão pro recibo
    cliente:         (data.cliente || '').trim(),
    pedidoId:        null,
    estoqueAplicado: !!jaRecebida,
    criadoEm:        serverTimestamp(),
  })
  if (jaRecebida) {
    batch.update(doc(db, 'produtos', data.produtoId), { estoqueAtual: increment(quantidade) })
  }
  return batch.commit()
}

// Lança as Compras de uma nota — mesmo fornecedor/status/observações. Uma nota
// com um produto só vira uma Compra no formato de sempre (plano, igual
// createCompra). Uma nota com 2+ produtos (ex: acessório comprado em lote, com
// produtos diferentes na mesma nota) vira UMA Compra só com "itens[]" — é a
// mesma compra, não faz sentido virar N linhas na lista pra 1 nota fiscal só.
export async function createComprasEmLote(comum, linhas) {
  const batch = writeBatch(db)
  const status = comum.status || STATUS_EM_ESTOQUE
  const jaRecebida = status === STATUS_EM_ESTOQUE
  const base = {
    fornecedor:      (comum.fornecedor || '').trim(),
    status,
    observacoes:     (comum.observacoes || '').trim(),
    cliente:         (comum.cliente || '').trim(),
    pedidoId:        null,
    criadoEm:        serverTimestamp(),
  }

  if (linhas.length > 1) {
    const itens = linhas.map(l => ({
      produtoId:  l.produtoId || null,
      produto:    (l.produto || '').trim(),
      quantidade: parseInt(l.quantidade) || 1,
      custo:      parseFloat(l.custo) || 0,
    }))
    const custoTotal = itens.reduce((s, i) => s + i.custo, 0)
    const produtoLabel = itens.map(i => i.produto).join(', ')
    const ref = doc(collection(db, COL))
    batch.set(ref, {
      ...base,
      produtoId:       null,
      produto:         produtoLabel,
      itens,
      custo:           custoTotal,
      estoqueAplicado: jaRecebida,
    })
    if (jaRecebida) {
      itens.forEach(i => {
        if (i.produtoId) batch.update(doc(db, 'produtos', i.produtoId), { estoqueAtual: increment(i.quantidade) })
      })
    }
    const pagamento = await gerarPagamentoCompra(ref.id, { custo: custoTotal, produto: produtoLabel, fornecedor: base.fornecedor, cliente: base.cliente, formaPagamento: comum.formaPagamento })
    if (pagamento) batch.set(doc(collection(db, 'financeiro')), pagamento)
    return batch.commit()
  }

  const l = linhas[0]
  const quantidade = parseInt(l.quantidade) || 1
  const custoLinha = parseFloat(l.custo) || 0
  const produtoLinha = (l.produto || '').trim()
  const ref = doc(collection(db, COL))
  batch.set(ref, {
    ...base,
    produtoId:       l.produtoId || null,
    produto:         produtoLinha,
    custo:           custoLinha,
    quantidade,
    estoqueAplicado: jaRecebida && !!l.produtoId,
  })
  if (jaRecebida && l.produtoId) {
    batch.update(doc(db, 'produtos', l.produtoId), { estoqueAtual: increment(quantidade) })
  }
  const pagamento = await gerarPagamentoCompra(ref.id, { custo: custoLinha, produto: produtoLinha, fornecedor: base.fornecedor, cliente: base.cliente, formaPagamento: comum.formaPagamento })
  if (pagamento) batch.set(doc(collection(db, 'financeiro')), pagamento)
  return batch.commit()
}

export async function patchCompra(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields })
}

// Muda o status da compra; se virar "estoque" numa compra avulsa (sem
// pedidoId) que ainda não deu entrada, soma 1 no estoqueAtual do produto
// vinculado — só compra lançada direto neste menu mexe em estoque (a que vem
// de pedido é compra-e-venda simultânea, ou fica Aguardando até o pedido ser
// entregue). Sair de "estoque" pra "concluído" não desconta de volta — quem
// consome (venda ou outro pedido) já cuida disso na hora.
export async function atualizarStatusCompra(compra, novoStatus) {
  const temItens = Array.isArray(compra.itens) && compra.itens.length
  const daEntradaEstoque = novoStatus === STATUS_EM_ESTOQUE && !compra.pedidoId && !compra.estoqueAplicado && (compra.produtoId || temItens)
  if (!daEntradaEstoque) {
    return patchCompra(compra.id, { status: novoStatus })
  }
  const batch = writeBatch(db)
  batch.update(doc(db, COL, compra.id), { status: novoStatus, estoqueAplicado: true })
  if (temItens) {
    compra.itens.forEach(i => {
      if (i.produtoId) batch.update(doc(db, 'produtos', i.produtoId), { estoqueAtual: increment(i.quantidade || 1) })
    })
  } else {
    batch.update(doc(db, 'produtos', compra.produtoId), { estoqueAtual: increment(compra.quantidade || 1) })
  }
  return batch.commit()
}

export async function updateCompra(id, data) {
  return updateDoc(doc(db, COL, id), {
    fornecedor:  (data.fornecedor  || '').trim(),
    custo:       parseFloat(data.custo) || 0,
    observacoes: (data.observacoes || '').trim(),
  })
}

// Edita uma compra lançada direto no menu (sem pedidoId) com o mesmo editor de
// itens da Nova Compra — dá pra corrigir produto/custo/quantidade errados sem
// excluir e relançar. Se a compra já tinha entrado em estoque (estoqueAplicado),
// reconcilia a diferença de quantidade por produto ao salvar, senão o estoque
// fica desalinhado quando a correção muda a quantidade ou troca o produto.
// Some pra 1 item (formato plano) ou vira itens[] (2+), igual createComprasEmLote.
export async function updateCompraItens(compra, itens, { fornecedor, observacoes }) {
  const novos = itens.map(it => ({
    produtoId:  it.produtoId || null,
    produto:    (it.produto || '').trim(),
    quantidade: parseInt(it.quantidade) || 1,
    custo:      parseFloat(it.custo) || 0,
  })).filter(it => it.produto)

  const antigos = Array.isArray(compra.itens) && compra.itens.length
    ? compra.itens
    : [{ produtoId: compra.produtoId || null, produto: compra.produto || '', quantidade: compra.quantidade || 1, custo: compra.custo || 0 }]

  const batch = writeBatch(db)

  if (compra.estoqueAplicado) {
    const deltaPorProduto = new Map()
    antigos.forEach(i => { if (i.produtoId) deltaPorProduto.set(i.produtoId, (deltaPorProduto.get(i.produtoId) || 0) - (i.quantidade || 1)) })
    novos.forEach(i => { if (i.produtoId) deltaPorProduto.set(i.produtoId, (deltaPorProduto.get(i.produtoId) || 0) + i.quantidade) })
    deltaPorProduto.forEach((delta, produtoId) => {
      if (delta !== 0) batch.update(doc(db, 'produtos', produtoId), { estoqueAtual: increment(delta) })
    })
  }

  const fields = {
    fornecedor:  (fornecedor  || '').trim(),
    observacoes: (observacoes || '').trim(),
  }
  if (novos.length > 1) {
    Object.assign(fields, {
      produtoId:  null,
      produto:    novos.map(i => i.produto).join(', '),
      itens:      novos,
      custo:      novos.reduce((s, i) => s + i.custo, 0),
      quantidade: deleteField(),
    })
  } else {
    const l = novos[0] || { produtoId: null, produto: '', quantidade: 1, custo: 0 }
    Object.assign(fields, {
      produtoId:  l.produtoId,
      produto:    l.produto,
      custo:      l.custo,
      quantidade: l.quantidade,
      itens:      deleteField(),
    })
  }
  batch.update(doc(db, COL, compra.id), fields)
  return batch.commit()
}

// Apaga a Compra e, se ela veio de um Pedido, o Pagamento gerado junto no
// Financeiro — sem isso o lançamento ficava órfão (sem Compra por trás) e
// preso, já que o Financeiro só deixa excluir lançamento avulso.
export async function deleteCompra(id) {
  const financeiroSnap = await getDocs(query(
    collection(db, 'financeiro'),
    where('origem.tipo', '==', 'compra'),
    where('origem.id', '==', id)
  ))
  const batch = writeBatch(db)
  batch.delete(doc(db, COL, id))
  financeiroSnap.docs.forEach(d => batch.delete(d.ref))
  return batch.commit()
}
