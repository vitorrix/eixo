import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

const COL = 'produtos'

export function subscribeProdutos(callback, onError) {
  const q = query(collection(db, COL), orderBy('nameLower'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function createProduto(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    ...sanitize(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  })
}

export async function updateProduto(id, data) {
  return updateDoc(doc(db, COL, id), { ...sanitize(data), updatedAt: serverTimestamp() })
}

export async function deleteProduto(id) {
  return deleteDoc(doc(db, COL, id))
}

export async function importarProdutos(rows) {
  const { uid } = getCurrentProfile()
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = writeBatch(db)
    rows.slice(i, i + CHUNK).forEach(row => {
      const ref = doc(collection(db, COL))
      batch.set(ref, {
        ...sanitize({
          nome:            String(row.nome        || '').trim(),
          categoria:       String(row.categoria   || '').trim(),
          precoCusto:      parseFloat(row.precocusto) || 0,
          precoVenda:      parseFloat(row.precovenda) || 0,
          controlaEstoque: String(row.controlaestoque || '').toLowerCase() === 'sim',
          estoqueAtual:    0,
          estoqueMinimo:   0,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      })
    })
    await batch.commit()
  }
}

function sanitize(d) {
  const custo   = parseFloat(d.precoCusto) || 0
  const venda   = parseFloat(d.precoVenda) || 0
  const margAbs = venda - custo
  const margPct = custo > 0 ? parseFloat(((margAbs / custo) * 100).toFixed(1)) : 0
  return {
    nome:            (d.nome      || '').trim(),
    nameLower:       (d.nome      || '').trim().toLowerCase(),
    categoria:       (d.categoria || '').trim(),
    categoriaLower:  (d.categoria || '').trim().toLowerCase(),
    precoCusto:      custo,
    precoVenda:      venda,
    margemAbs:       margAbs,
    margemPct:       margPct,
    controlaEstoque: !!d.controlaEstoque,
    estoqueAtual:    d.controlaEstoque ? (parseInt(d.estoqueAtual)  || 0) : 0,
    estoqueMinimo:   d.controlaEstoque ? (parseInt(d.estoqueMinimo) || 0) : 0,
  }
}
