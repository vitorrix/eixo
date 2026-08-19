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
  const statusEntrega = data.statusEntrega || 'aguardando'
  batch.set(ref, {
    produtoId:      data.produtoId || null,
    produto:        (data.produto || '').trim(),
    cliente:        (data.cliente || '').trim(),
    clienteId:      data.clienteId || null,
    valorVenda:     parseFloat(data.valorVenda) || 0,
    formaPagamento: data.formaPagamento || '',
    statusEntrega,
    ...(statusEntrega === 'entregue' ? { dataEntrega: serverTimestamp() } : {}),
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
  // Marca o instante da entrega pra alimentar o lembrete de pós-venda no
  // Dashboard (mostra 3 dias depois) — só quando o status está de fato
  // virando "entregue" agora, senão reeditar outro campo reiniciaria a contagem.
  if (patch.statusEntrega === 'entregue') patch.dataEntrega = serverTimestamp()
  return updateDoc(doc(db, COL, id), patch)
}

// Subconjunto usado pelo lembrete de pós-venda do Dashboard — filtra no
// servidor pra não abrir um listener sobre a coleção inteira de vendas.
export function subscribeVendasEntregues(callback, onError) {
  const q = query(collection(db, COL), where('statusEntrega', '==', 'entregue'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function marcarPosVendaFeito(id) {
  return updateDoc(doc(db, COL, id), { posVendaFeito: true, posVendaFeitoEm: serverTimestamp() })
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
