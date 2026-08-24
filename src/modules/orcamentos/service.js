import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

const COL = 'orcamentos'

export function subscribeOrcamentos(callback, onError) {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function createOrcamento(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...data,
    criadoPor: uid,
    criadoEm:  serverTimestamp(),
  })
}
