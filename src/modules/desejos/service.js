import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { unidadesDeEstoque, compararDesejo } from '../../shared/utils/desejos.js'

const COL = 'desejos'

export function subscribeDesejos(callback, onError) {
  return onSnapshot(collection(db, COL), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, onError)
}

// Estoque = compras em "estoque". Quem não tem permissão de ver Compras recebe
// erro do Firestore — a lista de desejos continua funcionando, só sem sinalização.
export function subscribeEstoque(callback, onError) {
  const q = query(collection(db, 'compras'), where('status', '==', 'estoque'))
  return onSnapshot(q, snap => callback(unidadesDeEstoque(snap.docs.map(d => ({ id: d.id, ...d.data() })))), onError)
}

const limpar = d => ({
  clienteId: d.clienteId || null,
  cliente:   (d.cliente || '').trim(),
  telefone:  (d.telefone || '').replace(/\D/g, ''),
  modelo:    (d.modelo || '').trim(),
  capacidade: d.capacidade || '',
  cor:       (d.cor || '').trim(),
  observacoes: (d.observacoes || '').trim(),
})

export async function createDesejo(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...limpar(data), status: 'aberto', avisadoEm: null,
    criadoPor: uid, criadoEm: serverTimestamp(),
  })
}

export const updateDesejo = (id, data) =>
  updateDoc(doc(db, COL, id), { ...limpar(data), atualizadoEm: serverTimestamp() })

// 'aberto' | 'atendido' | 'cancelado'
export const mudarStatusDesejo = (id, status) =>
  updateDoc(doc(db, COL, id), { status, atualizadoEm: serverTimestamp() })

export const registrarAviso = id => updateDoc(doc(db, COL, id), { avisadoEm: serverTimestamp() })

export const deleteDesejo = id => deleteDoc(doc(db, COL, id))

// Contador do menu: desejos abertos que já têm algo no estoque.
export async function contarDesejosComEstoque() {
  const [dSnap, cSnap] = await Promise.all([
    getDocs(query(collection(db, COL), where('status', '==', 'aberto'))),
    getDocs(query(collection(db, 'compras'), where('status', '==', 'estoque'))),
  ])
  const unidades = unidadesDeEstoque(cSnap.docs.map(d => ({ id: d.id, ...d.data() })))
  return dSnap.docs.filter(d => {
    const r = compararDesejo(d.data(), unidades)
    return r.identicos.length || r.semelhantes.length
  }).length
}
