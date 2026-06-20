import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { birthdayMD } from '../../shared/utils/formatters.js'

const COL = 'clientes'

export function subscribeClientes(callback, onError) {
  const q = query(collection(db, COL), orderBy('nameLower'))
  return onSnapshot(q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

// Busca aniversariantes de hoje (campo birthdayMD == "MM-DD" de hoje)
export function subscribeAniversariantes(callback) {
  const today = new Date()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const md = `${mm}-${dd}`

  const q = query(collection(db, COL), where('birthdayMD', '==', md))
  return onSnapshot(q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => callback([])
  )
}

export async function createCliente(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...sanitize(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  })
}

export async function updateCliente(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...sanitize(data),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCliente(id) {
  return deleteDoc(doc(db, COL, id))
}

function sanitize(data) {
  const bd = data.birthdate || ''
  return {
    type:       data.type,
    name:       data.name.trim(),
    nameLower:  data.name.trim().toLowerCase(),
    document:   data.document.replace(/\D/g, ''),
    phone:      data.phone.replace(/\D/g, ''),
    email:      data.email.trim().toLowerCase(),
    birthdate:  bd,
    birthdayMD: birthdayMD(bd),
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
