import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, writeBatch,
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
    atualizadoEm: serverTimestamp(),
  })
}

export async function patchPedido(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields, atualizadoEm: serverTimestamp() })
}

export async function deletePedido(id) {
  return deleteDoc(doc(db, COL, id))
}

export async function confirmarPagamento(pedido, { fornecedor, custo }) {
  const batch  = writeBatch(db)
  const prodStr = (pedido.produtos || []).map(p => p.nome).filter(Boolean).join(', ') || '—'

  batch.update(doc(db, 'pedidos', pedido.id), {
    status:       'pago',
    atualizadoEm: serverTimestamp(),
  })

  const compraRef = doc(collection(db, 'compras'))
  batch.set(compraRef, {
    pedidoId:   pedido.id,
    cliente:    pedido.cliente || '',
    produto:    prodStr,
    fornecedor: (fornecedor || '').trim(),
    custo:      parseFloat(custo) || 0,
    status:     'pendente',
    criadoEm:   serverTimestamp(),
  })

  const vendaRef = doc(collection(db, 'vendas'))
  batch.set(vendaRef, {
    pedidoId:       pedido.id,
    cliente:        pedido.cliente || '',
    produto:        prodStr,
    valorVenda:     pedido.valorNegociado || 0,
    formaPagamento: pedido.formaPagamento || '',
    statusEntrega:  'aguardando',
    reciboEmitido:  false,
    criadoEm:       serverTimestamp(),
  })

  return batch.commit()
}

function sanitize(d) {
  const produtos = (d.produtos || [])
    .map(p => ({
      nome:       (p.nome       || '').trim(),
      cor:        (p.cor        || '').trim(),
      valor:      parseFloat(p.valor) || 0,
      acessorios: (p.acessorios || []).filter(Boolean),
    }))
    .filter(p => p.nome)

  const valorNegociado = produtos.reduce((s, p) => s + p.valor, 0)

  return {
    dataContato:    d.dataContato    || '',
    cliente:        (d.cliente       || '').trim(),
    produtos,
    valorNegociado,
    formaPagamento: d.formaPagamento || '',
    troca:          d.troca          || null,
    observacoes:    (d.observacoes   || '').trim(),
  }
}
