import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

const COL = 'fornecedores'

export function subscribeFornecedores(callback, onError) {
  const q = query(collection(db, COL), orderBy('nameLower'))
  return onSnapshot(q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function createFornecedor(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...sanitize(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  })
}

export async function updateFornecedor(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...sanitize(data),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteFornecedor(id) {
  return deleteDoc(doc(db, COL, id))
}

function sanitize(data) {
  return {
    type:      data.type,
    name:      data.name.trim(),
    nameLower: data.name.trim().toLowerCase(),
    document:  (data.document || '').replace(/\D/g, ''),
    phone:     (data.phone || '').replace(/\D/g, ''),
    email:     (data.email || '').trim().toLowerCase(),
    box:       (data.box || '').trim(),
    address: {
      cep:         (data.address?.cep || '').replace(/\D/g, ''),
      logradouro:  (data.address?.logradouro || '').trim(),
      numero:      (data.address?.numero || '').trim(),
      complemento: (data.address?.complemento || '').trim(),
      bairro:      (data.address?.bairro || '').trim(),
      cidade:      (data.address?.cidade || '').trim(),
      estado:      (data.address?.estado || '').trim().toUpperCase(),
    },
    notes: (data.notes || '').trim(),
  }
}
