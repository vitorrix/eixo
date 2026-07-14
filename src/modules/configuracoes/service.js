import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase.js'

export async function getEmpresa() {
  const snap = await getDoc(doc(db, 'configuracoes', 'empresa'))
  return snap.exists() ? snap.data() : {}
}

// Numeração sequencial dos recibos — contador atômico, começa em 3300 (acima do
// último número visto no sistema antigo) pra não colidir com recibos já entregues.
export async function proximoNumeroRecibo() {
  const ref = doc(db, 'configuracoes', 'contadores')
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const atual = snap.exists() ? (snap.data().proximoRecibo || 3300) : 3300
    tx.set(ref, { proximoRecibo: atual + 1 }, { merge: true })
    return atual
  })
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
