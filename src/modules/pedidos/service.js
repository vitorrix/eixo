import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

const COL = 'pedidos'

export function subscribePedidos(callback, onError) {
  const q = query(collection(db, COL), orderBy('data', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function createPedido(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...sanitize(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  })
}

export async function updatePedido(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...sanitize(data),
    updatedAt: serverTimestamp(),
  })
}

export async function patchPedido(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields, updatedAt: serverTimestamp() })
}

export async function deletePedido(id) {
  return deleteDoc(doc(db, COL, id))
}

function sanitize(data) {
  const produtos = (data.produtos || []).map(p => {
    const custo = parseFloat(p.custo) || 0
    const venda = parseFloat(p.venda) || 0
    return {
      nome:           (p.nome || '').trim(),
      fornecedorId:   p.fornecedorId   || null,
      fornecedorNome: (p.fornecedorNome || '').trim(),
      custo, venda, lucro: venda - custo,
    }
  })
  const totalCusto = produtos.reduce((s, p) => s + p.custo, 0)
  const totalVenda = produtos.reduce((s, p) => s + p.venda, 0)
  return {
    data:          data.data          || '',
    clienteId:     data.clienteId     || null,
    clienteNome:   (data.clienteNome  || '').trim(),
    produtos,
    acessorios:    data.acessorios    || [],
    pagamento:     data.pagamento     || '',
    logistica:     data.logistica     || '',
    statusEntrega: data.statusEntrega || 'aguardando',
    sistemaOk:     !!data.sistemaOk,
    notaEnviada:   !!data.notaEnviada,
    inclui_troca:  !!data.inclui_troca,
    observacoes:   (data.observacoes  || '').trim(),
    totalCusto,
    totalVenda,
    totalMargem:   totalVenda - totalCusto,
  }
}
