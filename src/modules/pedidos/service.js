import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, where, getDocs, serverTimestamp, deleteField, writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

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
    atualizadoEm:   serverTimestamp(),
  })
}

// Editar um pedido em qualquer status: reseta o fluxo para negociando
export async function editarPedido(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...sanitize(data),
    formaPagamento: deleteField(),
    status:         'negociando',
    logistica:      deleteField(),
    atualizadoEm:   serverTimestamp(),
  })
}

export async function patchPedido(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields, atualizadoEm: serverTimestamp() })
}

export async function deletePedido(id) {
  return deleteDoc(doc(db, COL, id))
}

export function produtoLabel(pr) {
  return pr.tipo === 'manutencao'
    ? [pr.nome, pr.aparelho ? `(${pr.aparelho})` : ''].filter(Boolean).join(' ')
    : [pr.nome, pr.cor].filter(Boolean).join(' · ')
}

// Confirma o pagamento do pedido e, no mesmo lote, gera a Compra (custo/fornecedor
// informados agora) e a Venda (dados do próprio pedido) de cada item — produto ou
// manutenção. Não mexe em estoqueAtual: esse fluxo é sempre compra-e-venda simultânea
// (o produto nunca fica parado em estoque); só entra em estoque o que for lançado
// direto no menu Compras.
export async function confirmarPagamento(pedido, itensCompra) {
  const batch = writeBatch(db)

  batch.update(doc(db, COL, pedido.id), { status: 'pago', atualizadoEm: serverTimestamp() })

  pedido.produtos.forEach((p, i) => {
    const item  = itensCompra[i] || {}
    const label = produtoLabel(p)

    batch.set(doc(collection(db, 'compras')), {
      pedidoId:    pedido.id,
      cliente:     pedido.cliente,
      produto:     label,
      tipo:        p.tipo || 'produto',
      fornecedor:  (item.fornecedor || '').trim(),
      custo:       parseFloat(item.custo) || 0,
      status:      'comprado',
      observacoes: (item.observacoes || '').trim(),
      criadoEm:    serverTimestamp(),
    })

    batch.set(doc(collection(db, 'vendas')), {
      pedidoId:       pedido.id,
      cliente:        pedido.cliente,
      produto:        label,
      tipo:           p.tipo || 'produto',
      valorVenda:     p.valor || 0,
      formaPagamento: (pedido.formasPagamento || [])[0] || '',
      statusEntrega:  'aguardando',
      reciboEmitido:  false,
      criadoEm:       serverTimestamp(),
    })
  })

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

export async function marcarEntregue(id) {
  await patchPedido(id, { status: 'entregue' })
  return syncVendasEntrega(id, 'entregue')
}

function sanitize(d) {
  const produtos = (d.produtos || [])
    .map(p => {
      const tipo = p.tipo === 'manutencao' ? 'manutencao' : 'produto'
      if (tipo === 'manutencao') {
        return {
          tipo,
          nome:       (p.nome     || '').trim(), // serviço selecionado (ex: Troca de Tela)
          aparelho:   (p.aparelho || '').trim(),
          valor:      parseFloat(p.valor) || 0,
          acessorios: [],
        }
      }
      return {
        tipo,
        nome:       (p.nome       || '').trim(),
        cor:        (p.cor        || '').trim(),
        valor:      parseFloat(p.valor) || 0,
        acessorios: (p.acessorios || []).filter(Boolean),
      }
    })
    .filter(p => p.nome)

  const valorNegociado = produtos.reduce((s, p) => s + p.valor, 0)
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
    troca:          d.troca       || null,
    observacoes:    (d.observacoes || '').trim(),
  }
}
