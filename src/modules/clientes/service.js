import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, where,
  serverTimestamp, writeBatch,
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

export async function createClienteRapido(name, phone = '', type = 'PF') {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    type,
    name: name.trim(),
    nameLower: name.trim().toLowerCase(),
    document: '',
    phone: phone.replace(/\D/g, ''),
    email: '',
    birthdate: '',
    birthdayMD: '',
    address: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '' },
    notes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  })
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

export async function deletarClientes(ids) {
  const CHUNK = 500
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = writeBatch(db)
    ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, COL, id)))
    await batch.commit()
  }
}

export async function importarClientes(rows) {
  const { uid } = getCurrentProfile()
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db)
    rows.slice(i, i + CHUNK).forEach(row => {
      const ref = doc(collection(db, COL))
      const docDigits = String(row.cpfCnpj || '').replace(/\D/g, '')
      const type = docDigits.length === 14 ? 'pj' : 'pf'
      const name = String(row.nome || '').trim()
      const bd = parseDateStr(row.dataNascimento)
      const nomeFantasia = String(row.nomeFantasia || '').trim()
      batch.set(ref, {
        type,
        name,
        nameLower:  name.toLowerCase(),
        document:   docDigits,
        phone:      String(row.telefone || '').replace(/\D/g, ''),
        email:      String(row.email || '').trim().toLowerCase(),
        birthdate:  bd,
        birthdayMD: birthdayMD(bd),
        address: {
          cep:         String(row.cep || '').replace(/\D/g, ''),
          logradouro:  String(row.endereco || '').trim(),
          numero:      String(row.numero || '').trim(),
          complemento: String(row.complemento || '').trim(),
          bairro:      String(row.bairro || '').trim(),
          cidade:      String(row.cidade || '').trim(),
          estado:      String(row.uf || '').trim().toUpperCase(),
        },
        notes:     nomeFantasia ? `Nome Fantasia: ${nomeFantasia}` : '',
        codLegado: String(row.codAntigo || '').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      })
    })
    await batch.commit()
  }
}

function parseDateStr(val) {
  if (!val) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val).trim()
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
