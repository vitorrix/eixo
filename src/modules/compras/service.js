import {
  collection, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp,
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

export async function patchCompra(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields })
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
