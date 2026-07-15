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
  const base = { formasPagamento: [], contas: [], categorias: [] }
  if (!snap.exists()) return base
  return { ...base, ...snap.data() }
}

export async function saveOperacoes(data) {
  await setDoc(doc(db, 'configuracoes', 'operacoes'), data)
}

// Numeração sequencial dos lançamentos financeiros — mesmo padrão do contador
// de recibo, contador atômico próprio pra não misturar as duas sequências.
export async function proximoNumeroFinanceiro() {
  const ref = doc(db, 'configuracoes', 'contadores')
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const atual = snap.exists() ? (snap.data().proximoFinanceiro || 1) : 1
    tx.set(ref, { proximoFinanceiro: atual + 1 }, { merge: true })
    return atual
  })
}
