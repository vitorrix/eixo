import {
  collection, addDoc, updateDoc,
  doc, onSnapshot, query, orderBy, where, getDocs, serverTimestamp, writeBatch, increment,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

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
  const { uid } = getCurrentProfile()
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
    criadoPor:      uid,
    criadoEm:       serverTimestamp(),
  })
  if (data.produtoId) {
    batch.update(doc(db, 'produtos', data.produtoId), { estoqueAtual: increment(-1) })
  }
  return batch.commit()
}

export async function patchVenda(id, fields) {
  const patch = { ...fields }
  if (patch.valorVenda !== undefined) patch.valorVenda = parseFloat(patch.valorVenda) || 0
  return updateDoc(doc(db, COL, id), patch)
}

// Desfaz a entrada de estoque se a venda avulsa tinha descontado 1 na criação —
// venda vinda de pedido nunca mexeu em estoque, então não devolve nada. Se a
// venda veio de um Pedido, também apaga o Recebimento gerado junto no
// Financeiro — mesmo motivo do deleteCompra: sem isso o lançamento ficava
// órfão e preso (Financeiro só deixa excluir lançamento avulso).
export async function deleteVenda(venda) {
  const financeiroSnap = await getDocs(query(
    collection(db, 'financeiro'),
    where('origem.tipo', '==', 'venda'),
    where('origem.id', '==', venda.id)
  ))
  const batch = writeBatch(db)
  batch.delete(doc(db, COL, venda.id))
  financeiroSnap.docs.forEach(d => batch.delete(d.ref))
  if (!venda.pedidoId && venda.produtoId) {
    batch.update(doc(db, 'produtos', venda.produtoId), { estoqueAtual: increment(1) })
  }
  return batch.commit()
}
