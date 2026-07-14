import {
  collection, addDoc, updateDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore'
import { db } from '../../firebase.js'

const COL = 'vendas'

export function subscribeVendas(callback, onError) {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

// Venda avulsa (sem vir de pedido) — desconta 1 do estoqueAtual do produto na
// hora, já que só entra estoque o que foi lançado direto no menu Compras.
export async function createVenda(data) {
  const batch = writeBatch(db)
  const ref = doc(collection(db, COL))
  batch.set(ref, {
    produtoId:      data.produtoId || null,
    produto:        (data.produto || '').trim(),
    cliente:        (data.cliente || '').trim(),
    valorVenda:     parseFloat(data.valorVenda) || 0,
    formaPagamento: data.formaPagamento || '',
    statusEntrega:  data.statusEntrega || 'aguardando',
    reciboEmitido:  false,
    pedidoId:       null,
    criadoEm:       serverTimestamp(),
  })
  if (data.produtoId) {
    batch.update(doc(db, 'produtos', data.produtoId), { estoqueAtual: increment(-1) })
  }
  return batch.commit()
}

export async function patchVenda(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields })
}

// Desfaz a entrada de estoque se a venda avulsa tinha descontado 1 na criação —
// venda vinda de pedido nunca mexeu em estoque, então não devolve nada.
export async function deleteVenda(venda) {
  const batch = writeBatch(db)
  batch.delete(doc(db, COL, venda.id))
  if (!venda.pedidoId && venda.produtoId) {
    batch.update(doc(db, 'produtos', venda.produtoId), { estoqueAtual: increment(1) })
  }
  return batch.commit()
}
