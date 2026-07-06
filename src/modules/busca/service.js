import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'

const COL = 'ofertas'

export function subscribeOfertas(callback, onError) {
  const q = query(collection(db, COL), orderBy('preco'))
  return onSnapshot(q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}
