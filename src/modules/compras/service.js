import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore'
import { db } from '../../firebase.js'

const COL = 'compras'

export function subscribeCompras(callback, onError) {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

// Se a compra já nasce com status "recebido", já soma no estoque de cara —
// mesma regra usada quando o status muda depois via atualizarStatusCompra.
export async function createCompra(data) {
  const status = data.status || 'pendente'
  const jaRecebida = status === 'recebido' && data.produtoId

  const batch = writeBatch(db)
  const ref = doc(collection(db, COL))
  batch.set(ref, {
    produtoId:       data.produtoId || null,
    produto:         (data.produto    || '').trim(),
    fornecedor:      (data.fornecedor || '').trim(),
    custo:           parseFloat(data.custo) || 0,
    status,
    cliente:         '',
    pedidoId:        null,
    estoqueAplicado: !!jaRecebida,
    criadoEm:        serverTimestamp(),
  })
  if (jaRecebida) {
    batch.update(doc(db, 'produtos', data.produtoId), { estoqueAtual: increment(1) })
  }
  return batch.commit()
}

export async function patchCompra(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields })
}

// Muda o status da compra; se virar "recebido" numa compra avulsa (sem pedidoId)
// que ainda não deu entrada, soma 1 no estoqueAtual do produto vinculado — só
// compra lançada direto neste menu mexe em estoque (a que vem de pedido é
// compra-e-venda simultânea, nunca fica parada em estoque).
export async function atualizarStatusCompra(compra, novoStatus) {
  const daEntradaEstoque = novoStatus === 'recebido' && !compra.pedidoId && !compra.estoqueAplicado && compra.produtoId
  if (!daEntradaEstoque) {
    return patchCompra(compra.id, { status: novoStatus })
  }
  const batch = writeBatch(db)
  batch.update(doc(db, COL, compra.id), { status: novoStatus, estoqueAplicado: true })
  batch.update(doc(db, 'produtos', compra.produtoId), { estoqueAtual: increment(1) })
  return batch.commit()
}

export async function updateCompra(id, data) {
  return updateDoc(doc(db, COL, id), {
    fornecedor: (data.fornecedor || '').trim(),
    custo:      parseFloat(data.custo) || 0,
  })
}

export async function deleteCompra(id) {
  return deleteDoc(doc(db, COL, id))
}
