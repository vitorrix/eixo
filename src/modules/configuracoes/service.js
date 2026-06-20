import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../../firebase.js'

export async function getEmpresa() {
  const snap = await getDoc(doc(db, 'configuracoes', 'empresa'))
  return snap.exists() ? snap.data() : {}
}

export async function saveEmpresa(data) {
  await setDoc(doc(db, 'configuracoes', 'empresa'), data, { merge: true })
}

export async function getOperacoes() {
  const snap = await getDoc(doc(db, 'configuracoes', 'operacoes'))
  if (!snap.exists()) return { formasPagamento: [], contas: [] }
  return snap.data()
}

export async function saveOperacoes(data) {
  await setDoc(doc(db, 'configuracoes', 'operacoes'), data)
}
