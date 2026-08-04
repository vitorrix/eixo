import {
  collection, addDoc, updateDoc, doc, getDoc,
  onSnapshot, query, orderBy, where, getDocs, serverTimestamp, deleteField, writeBatch, increment,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { getOperacoes, proximoNumeroFinanceiro } from '../configuracoes/service.js'

const COL = 'pedidos'

export function subscribePedidos(callback, onError) {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function createPedido(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...sanitize(data),
    status:       'negociando',
    criadoEm:     serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    criadoPor:    uid,
  })
}

export async function updatePedido(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...sanitize(data),
    formaPagamento: deleteField(),
    troca:          deleteField(),
    atualizadoEm:   serverTimestamp(),
  })
}

// Editar um pedido em qualquer status: reseta o fluxo para negociando
export async function editarPedido(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...sanitize(data),
    formaPagamento: deleteField(),
    troca:          deleteField(),
    status:         'negociando',
    logistica:      deleteField(),
    atualizadoEm:   serverTimestamp(),
  })
}

export async function patchPedido(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields, atualizadoEm: serverTimestamp() })
}

// Apaga o Pedido junto com Compra(s)/Venda/Financeiro gerados por ele —
// mesma limpeza de limparCompraEVenda, só que sem regenerar nada depois.
export async function deletePedido(id) {
  const batch = writeBatch(db)
  await limparCompraEVenda(id, batch)
  batch.delete(doc(db, COL, id))
  return batch.commit()
}

export function produtoLabel(pr) {
  return pr.tipo === 'manutencao'
    ? [pr.nome, pr.aparelho ? `(${pr.aparelho})` : ''].filter(Boolean).join(' ')
    : [pr.nome, pr.cor].filter(Boolean).join(' · ')
}

// Apaga Compra(s)/Venda/lançamentos financeiros já vinculados a esse pedido —
// usado antes de gerar novos, pra nunca duplicar quando o pedido foi editado e
// reconfirmado (a edição reseta o status pra negociando, mas não limpa o que
// já tinha sido gerado; sem isso, cada reconfirmação criava registros extras).
//
// Compra com estoqueAplicado=true ou status "concluído" não nasceu desse
// fluxo — é uma unidade que já estava em estoque (lançada avulsa em Compras)
// e só foi vinculada/consumida aqui. Apagar destruiria o registro real da
// compra; em vez disso desvincula e devolve a unidade pro estoque, pra
// reconfirmar/editar/excluir o pedido nunca fazer sumir uma compra de verdade.
async function limparCompraEVenda(pedidoId, batch) {
  const [comprasSnap, vendasSnap, financeiroSnap] = await Promise.all([
    getDocs(query(collection(db, 'compras'),   where('pedidoId', '==', pedidoId))),
    getDocs(query(collection(db, 'vendas'),    where('pedidoId', '==', pedidoId))),
    getDocs(query(collection(db, 'financeiro'), where('origem.pedidoId', '==', pedidoId))),
  ])
  comprasSnap.docs.forEach(d => {
    const c = d.data()
    if (c.estoqueAplicado || c.status === 'concluido') {
      batch.update(d.ref, { pedidoId: null, cliente: '', status: 'estoque' })
      if (c.produtoId) batch.update(doc(db, 'produtos', c.produtoId), { estoqueAtual: increment(1) })
    } else {
      batch.delete(d.ref)
    }
  })
  vendasSnap.docs.forEach(d => {
    // Acessório não tem Compra por trás — o desconto de estoque foi direto no
    // produto, registrado aqui pra poder devolver certinho (a quantidade pode
    // já ter mudado no pedido desde a confirmação original).
    ;(d.data().estoqueAcessorios || []).forEach(({ produtoId, quantidade }) => {
      batch.update(doc(db, 'produtos', produtoId), { estoqueAtual: increment(quantidade) })
    })
    batch.delete(d.ref)
  })
  financeiroSnap.docs.forEach(d => batch.delete(d.ref))
}

// Gera a Compra (custo/fornecedor informados agora) de cada item — produto ou
// manutenção — e UMA Venda pro pedido inteiro, com todos os itens dentro
// (mesmo agrupamento do recibo). Compra continua uma por aparelho, já que
// custo/fornecedor são rastreados por unidade; Venda é o registro da venda em
// si, que é sempre do pedido como um todo, não de cada aparelho separado.
// Compra nasce "aguardando" — quando o pedido for marcado como entregue
// (marcarEntregue), vira "concluído" (foi direto pro cliente, nunca passa por
// estoque; só entra em estoque o que for lançado direto no menu Compras).
//
// Se o pedido inclui troca, gera também a Compra do aparelho usado — a Baruk
// compra do próprio cliente, então fornecedor = cliente e custo = crédito
// dado. Essa também nasce "aguardando", mas ao contrário da compra normal
// vira "estoque" quando o pedido é entregue (o aparelho do cliente chegou e
// fica disponível pra puxar depois em outro pedido).
//
// Junto, já lança no Financeiro: 1 Pagamento por item com custo informado
// (vinculado à Compra), 1 Pagamento da troca quando houver, e 1 Recebimento pro
// pedido inteiro (vinculado à Venda) — todos marcados como já liquidados, já
// que "confirmar pagamento"/"efetuar compra" representa o dinheiro já ter
// saído/entrado nesse momento.
async function criarCompraEVenda(batch, pedido, itensCompra, pagamentosPorForma) {
  const hoje = new Date().toISOString().slice(0, 10)
  const operacoes = await getOperacoes()
  const formasNorm = normalizarFormasPagamento(pedido)
  const formaPag = formasNorm.map(f => f.nome).filter(Boolean).join(' + ')
  const contaPadrao = operacoes.formasPagamento?.find(f => f.nome === formasNorm[0]?.nome)?.contaPadrao || ''
  const categoriaReceber = operacoes.categorias?.find(c => c.tipo === 'receber')?.nome || ''
  const categoriaPagar = operacoes.categorias?.find(c => c.tipo === 'pagar' && c.grupo === 'Custo dos Produtos Vendidos (CMV)')?.nome
    || operacoes.categorias?.find(c => c.tipo === 'pagar')?.nome || ''
  // Pagamento de aparelho (Compra/Troca gerada pelo Pedido) sempre sai da
  // Nubank — não depende da forma de pagamento do cliente, é regra do caixa.
  const contaPagamentoAparelho = 'Nubank'

  const totalItem = p => (parseFloat(p.valor) || 0) * (parseInt(p.quantidade) || 1) - (parseFloat(p.desconto) || 0)

  const itensVenda = []
  // Acessório nunca entra aqui — mesma filtragem usada na tela de Confirmar
  // Pagamento (pedidos/list.js), pra "itensCompra[i]" bater com o item certo.
  const itensCompraveis = pedido.produtos.filter(p => p.tipo !== 'acessorio')
  for (let i = 0; i < itensCompraveis.length; i++) {
    const p     = itensCompraveis[i]
    const item  = itensCompra[i] || {}

    // Aparelho já estava em estoque (comprado avulso, ex: direto de um
    // cliente) — só vincula a Compra existente ao pedido, sem criar Compra
    // nem Pagamento novos: o custo já foi pago quando a compra original foi
    // lançada. O label da Venda usa o produto da Compra (não o texto livre do
    // item), pra bater exato com o que relatorios/vendasCalc.js espera.
    if (item.estoqueCompraId) {
      const compraRef = doc(db, 'compras', item.estoqueCompraId)
      const compraSnap = await getDoc(compraRef)
      const compraData = compraSnap.data() || {}
      batch.update(compraRef, { pedidoId: pedido.id, cliente: pedido.cliente, status: 'concluido' })
      if (compraData.produtoId) {
        batch.update(doc(db, 'produtos', compraData.produtoId), { estoqueAtual: increment(-1) })
      }
      itensVenda.push({ produto: compraData.produto || produtoLabel(p), tipo: p.tipo || 'produto', valor: totalItem(p), quantidade: parseInt(p.quantidade) || 1 })
      continue
    }

    const label = produtoLabel(p)
    const custo = parseFloat(item.custo) || 0
    const fornecedor = (item.fornecedor || '').trim()

    const compraRef = doc(collection(db, 'compras'))
    batch.set(compraRef, {
      pedidoId:    pedido.id,
      cliente:     pedido.cliente,
      produto:     label,
      tipo:        p.tipo || 'produto',
      fornecedor,
      custo,
      status:      'aguardando',
      observacoes: (item.observacoes || '').trim(),
      criadoEm:    serverTimestamp(),
    })

    if (custo > 0) {
      const numero = await proximoNumeroFinanceiro()
      batch.set(doc(collection(db, 'financeiro')), {
        numero, tipo: 'pagar',
        descricao:       `Compra: ${label}`,
        valor:           custo,
        contato:         fornecedor,
        categoria:       categoriaPagar,
        conta:           contaPagamentoAparelho,
        formaPagamento:  '',
        liquidado:       true,
        dataVencimento:  hoje,
        dataLiquidacao:  hoje,
        numeroDocumento: '',
        observacoes:     '',
        parcela:         { numero: 1, total: 1 },
        origem:          { tipo: 'compra', id: compraRef.id, pedidoId: pedido.id },
        recorrencia:     null,
        criadoEm:        serverTimestamp(),
      })
    }

    itensVenda.push({ produto: label, tipo: p.tipo || 'produto', valor: totalItem(p), quantidade: parseInt(p.quantidade) || 1 })
  }

  // Acessório: o custo já foi pago na compra em lote lançada direto em
  // Compras (nunca gera Compra/Pagamento novo aqui) — só desconta do estoque
  // do catálogo, sempre (brinde ou vendido, a unidade física sai igual), e só
  // vira linha de receita na Venda quando o preço da linha é > 0 (não-brinde).
  // "estoqueAcessorios" vai gravado na própria Venda — é dali que
  // limparCompraEVenda lê quanto devolver pro estoque se o pedido for editado/
  // apagado depois; ler direto do pedido na hora não bastaria, porque a
  // quantidade pode já ter mudado desde a confirmação original.
  const estoqueAcessorios = []
  for (const ac of pedido.produtos.filter(p => p.tipo === 'acessorio')) {
    const qtd = parseInt(ac.quantidade) || 1
    if (ac.produtoId) {
      batch.update(doc(db, 'produtos', ac.produtoId), { estoqueAtual: increment(-qtd) })
      estoqueAcessorios.push({ produtoId: ac.produtoId, quantidade: qtd })
    }
    const totalAcessorio = totalItem(ac)
    if (totalAcessorio > 0) {
      itensVenda.push({ produto: ac.nome, tipo: 'acessorio', valor: totalAcessorio, quantidade: qtd })
    }
  }

  // Troca: a Baruk COMPRA o(s) aparelho(s) usado(s) do próprio cliente do pedido,
  // então cada troca vira uma Compra com fornecedor = cliente e custo = crédito
  // concedido. O Recebimento da venda é lançado pelo valor cheio (sem descontar
  // a troca), então esse Pagamento é o que fecha o caixa no líquido — e de
  // quebra joga o custo do aparelho usado no CMV, como qualquer outra compra.
  // Cliente pode dar mais de um aparelho na troca — por isso é um loop.
  for (const troca of normalizarTrocasPedido(pedido)) {
    const creditoTroca = parseFloat(troca.valorCredito) || 0

    const compraTrocaRef = doc(collection(db, 'compras'))
    batch.set(compraTrocaRef, {
      pedidoId:    pedido.id,
      cliente:     pedido.cliente,
      produto:     troca.produto,
      tipo:        'produto',
      fornecedor:  pedido.cliente,
      custo:       creditoTroca,
      status:      'aguardando',
      origemTroca: true,
      observacoes: (troca.observacoes || '').trim(),
      criadoEm:    serverTimestamp(),
    })

    if (creditoTroca > 0) {
      const numeroTroca = await proximoNumeroFinanceiro()
      batch.set(doc(collection(db, 'financeiro')), {
        numero: numeroTroca, tipo: 'pagar',
        descricao:       `Troca: ${troca.produto}`,
        valor:           creditoTroca,
        contato:         pedido.cliente,
        categoria:       categoriaPagar,
        conta:           contaPagamentoAparelho,
        formaPagamento:  '',
        liquidado:       true,
        dataVencimento:  hoje,
        dataLiquidacao:  hoje,
        numeroDocumento: '',
        observacoes:     (troca.observacoes || '').trim(),
        parcela:         { numero: 1, total: 1 },
        origem:          { tipo: 'compra', id: compraTrocaRef.id, pedidoId: pedido.id },
        recorrencia:     null,
        criadoEm:        serverTimestamp(),
      })
    }
  }

  const vendaRef = doc(collection(db, 'vendas'))
  const valorVenda = itensVenda.reduce((s, it) => s + it.valor, 0)
  batch.set(vendaRef, {
    pedidoId:       pedido.id,
    cliente:        pedido.cliente,
    itens:          itensVenda,
    valorVenda,
    formaPagamento: formaPag,
    statusEntrega:  'aguardando',
    reciboEmitido:  false,
    estoqueAcessorios,
    criadoEm:       serverTimestamp(),
  })

  // Pedido com 2+ formas e valor dividido (validado no form): 1 Recebimento
  // por forma, cada um podendo já nascer liquidado ou pendente (ex: Pix pago
  // na hora, Cartão só daqui uns dias) — dá pra liquidar cada um separado
  // depois, direto no Financeiro. Sem divisão (forma única, ou pedido no
  // formato antigo), continua exatamente como sempre foi: 1 Recebimento só,
  // já liquidado.
  if (pagamentosPorForma?.length > 1) {
    for (const pf of pagamentosPorForma) {
      const contaPf = operacoes.formasPagamento?.find(f => f.nome === pf.nome)?.contaPadrao || ''
      const numero = await proximoNumeroFinanceiro()
      batch.set(doc(collection(db, 'financeiro')), {
        numero, tipo: 'receber',
        descricao:       `Venda — ${pedido.cliente}`,
        valor:           pf.valor,
        contato:         pedido.cliente,
        categoria:       categoriaReceber,
        conta:           contaPf,
        formaPagamento:  pf.nome,
        liquidado:       pf.liquidado,
        dataVencimento:  pf.dataVencimento || hoje,
        dataLiquidacao:  pf.liquidado ? hoje : null,
        numeroDocumento: '',
        observacoes:     '',
        parcela:         { numero: 1, total: 1 },
        origem:          { tipo: 'venda', id: vendaRef.id, pedidoId: pedido.id },
        recorrencia:     null,
        criadoEm:        serverTimestamp(),
      })
    }
  } else {
    const numeroReceber = await proximoNumeroFinanceiro()
    batch.set(doc(collection(db, 'financeiro')), {
      numero: numeroReceber, tipo: 'receber',
      descricao:       `Venda — ${pedido.cliente}`,
      valor:           valorVenda,
      contato:         pedido.cliente,
      categoria:       categoriaReceber,
      conta:           contaPadrao,
      formaPagamento:  formaPag,
      liquidado:       true,
      dataVencimento:  hoje,
      dataLiquidacao:  hoje,
      numeroDocumento: '',
      observacoes:     '',
      parcela:         { numero: 1, total: 1 },
      origem:          { tipo: 'venda', id: vendaRef.id, pedidoId: pedido.id },
      recorrencia:     null,
      criadoEm:        serverTimestamp(),
    })
  }
}

// Confirma o pagamento e já efetua a compra (fluxo "Sim, efetuar compra agora").
// Limpa qualquer Compra/Venda/financeiro antigos desse pedido antes de gerar
// os novos — cobre o caso de reconfirmação após edição, sem nunca duplicar.
export async function confirmarPagamento(pedido, itensCompra, pagamentosPorForma) {
  const batch = writeBatch(db)
  await limparCompraEVenda(pedido.id, batch)
  const status = pagamentosPorForma?.some(pf => !pf.liquidado) ? 'pago_parcial' : 'pago'
  batch.update(doc(db, COL, pedido.id), { status, compraFeita: true, atualizadoEm: serverTimestamp() })
  await criarCompraEVenda(batch, pedido, itensCompra, pagamentosPorForma)
  return batch.commit()
}

// Confirma o pagamento sem efetuar a compra agora (fluxo "Não") — fica pendente
// pra lançar depois em "Efetuar Compra". Também limpa Compra/Venda/financeiro
// antigos do pedido, já que uma edição pode ter tornado obsoletos os dados
// anteriores.
export async function confirmarPagamentoSemCompra(pedido) {
  const batch = writeBatch(db)
  await limparCompraEVenda(pedido.id, batch)
  batch.update(doc(db, COL, pedido.id), { status: 'pago', compraFeita: false, atualizadoEm: serverTimestamp() })
  return batch.commit()
}

// Efetua a compra de um pedido que já está pago mas ficou pendente (respondeu
// "Não" no prompt). Não mexe no status — só gera Compra + Venda + financeiro.
// Também limpa antes, pelo mesmo motivo de confirmarPagamento — sem isso,
// clicar "Efetuar Compra" duas vezes (ou depois de reeditar o pedido) geraria
// registros duplicados de novo.
export async function efetuarCompra(pedido, itensCompra, pagamentosPorForma) {
  const batch = writeBatch(db)
  await limparCompraEVenda(pedido.id, batch)
  const status = pagamentosPorForma?.some(pf => !pf.liquidado) ? 'pago_parcial' : 'pago'
  batch.update(doc(db, COL, pedido.id), { status, compraFeita: true, atualizadoEm: serverTimestamp() })
  await criarCompraEVenda(batch, pedido, itensCompra, pagamentosPorForma)
  return batch.commit()
}

// A entrega da Venda obedece a logística do Pedido — nunca editada à mão
// quando vem de pedido (só vendas avulsas, sem pedidoId, têm status livre).
async function syncVendasEntrega(pedidoId, statusEntrega) {
  const snap = await getDocs(query(collection(db, 'vendas'), where('pedidoId', '==', pedidoId)))
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.docs.forEach(d => batch.update(d.ref, { statusEntrega }))
  return batch.commit()
}

export async function definirLogistica(id, tipo) {
  await patchPedido(id, { status: tipo, 'logistica.tipo': tipo })
  return syncVendasEntrega(id, tipo)
}

export async function salvarRoteiro(id, roteiro) {
  return patchPedido(id, { 'logistica.roteiro': roteiro })
}

// Resolve o "aguardando" das Compras geradas por esse pedido: a de troca vira
// "estoque" (o aparelho do cliente chegou, fica disponível pra puxar depois);
// a normal (sem troca) vira "concluído" (foi direto pro cliente, nunca passa
// por estoque). Só mexe nas que ainda estão aguardando.
async function resolverComprasAguardando(pedidoId, batch) {
  const snap = await getDocs(query(
    collection(db, 'compras'),
    where('pedidoId', '==', pedidoId),
    where('status', '==', 'aguardando')
  ))
  snap.docs.forEach(d => {
    batch.update(d.ref, { status: d.data().origemTroca ? 'estoque' : 'concluido' })
  })
}

export async function marcarEntregue(id) {
  const batch = writeBatch(db)
  batch.update(doc(db, COL, id), { status: 'entregue', atualizadoEm: serverTimestamp() })
  await resolverComprasAguardando(id, batch)
  await batch.commit()
  return syncVendasEntrega(id, 'entregue')
}

// Troca sem produto informado não é troca — filtra fora pra não gerar Compra
// vazia lá na confirmação do pagamento. Cliente pode dar mais de um aparelho.
function sanitizeTrocas(trocas) {
  return (trocas || [])
    .map(t => ({
      produto:      (t?.produto || '').trim(),
      valorCredito: parseFloat(t?.valorCredito) || 0,
      observacoes:  (t?.observacoes || '').trim(),
    }))
    .filter(t => t.produto)
}

// Lê as trocas do pedido aceitando os dois formatos: array novo (trocas) ou
// objeto único legado (troca), de pedidos criados antes de suportar mais de uma.
export function normalizarTrocasPedido(pedido) {
  if (Array.isArray(pedido.trocas)) return pedido.trocas.filter(t => t?.produto)
  if (pedido.troca?.produto) return [pedido.troca]
  return []
}

// Lê formasPagamento aceitando os dois formatos: novo ({nome, valor}[], com o
// valor de cada forma dividido) ou antigo (string[], de pedido criado antes de
// dividir por forma — nesse caso "valor" fica null, sinalizando "desconhecido/
// vale o total", já que o formato antigo nunca guardou a divisão).
export function normalizarFormasPagamento(pedido) {
  const raw = Array.isArray(pedido?.formasPagamento) ? pedido.formasPagamento
    : (pedido?.formaPagamento ? [pedido.formaPagamento] : [])
  return raw.map(f => typeof f === 'string' ? { nome: f, valor: null } : { nome: f?.nome || '', valor: f?.valor ?? null })
}

// true só quando dá pra confiar na divisão de valor por forma — 2+ formas,
// todas com valor numérico > 0 (pedido novo, passou pela validação do form).
// 1 forma só nunca precisa de divisão (vale o total inteiro); formato antigo
// (valor null) também cai fora — trata como forma única, igual sempre foi.
export function temDivisaoPorForma(pedido) {
  const formas = normalizarFormasPagamento(pedido)
  return formas.length > 1 && formas.every(f => typeof f.valor === 'number' && f.valor > 0)
}

function sanitize(d) {
  const produtos = (d.produtos || [])
    .map(p => {
      const tipo = ['manutencao', 'acessorio'].includes(p.tipo) ? p.tipo : 'produto'
      const base = {
        tipo,
        nome:       (p.nome || '').trim(),
        valor:      parseFloat(p.valor) || 0,
        quantidade: Math.max(1, parseInt(p.quantidade) || 1),
        desconto:   parseFloat(p.desconto) || 0,
      }
      if (tipo === 'manutencao') return { ...base, aparelho: (p.aparelho || '').trim() }
      if (tipo === 'acessorio')  return { ...base, produtoId: p.produtoId || null }
      return { ...base, cor: (p.cor || '').trim(), produtoId: p.produtoId || null }
    })
    .filter(p => p.nome)

  const valorNegociado = produtos.reduce((s, p) => s + (p.valor * p.quantidade - p.desconto), 0)
  const temManutencao  = produtos.some(p => p.tipo === 'manutencao') // pra filtrar em relatórios sem varrer o array

  const formasPagamento = Array.isArray(d.formasPagamento)
    ? d.formasPagamento
    : (d.formaPagamento ? [d.formaPagamento] : [])

  return {
    dataContato:    d.dataContato || '',
    cliente:        (d.cliente    || '').trim(),
    produtos,
    valorNegociado,
    temManutencao,
    formasPagamento,
    trocas:         sanitizeTrocas(d.trocas),
    observacoes:    (d.observacoes || '').trim(),
  }
}
