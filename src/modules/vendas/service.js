import {
  collection, updateDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp,
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

export async function patchVenda(id, fields) {
  return updateDoc(doc(db, COL, id), { ...fields })
}
