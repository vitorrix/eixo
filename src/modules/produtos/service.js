import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

const COL = 'produtos'

export function subscribeProdutos(callback, onError) {
  const q = query(collection(db, COL), orderBy('nameLower'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

export async function uploadImagem(file, id) {
  const storageRef = ref(storage, `produtos/${id}/imagem`)
  const snap = await uploadBytes(storageRef, file)
  return getDownloadURL(snap.ref)
}

export async function createProduto(data, imagemFile) {
  const { uid } = getCurrentProfile()
  const docRef = await addDoc(collection(db, COL), {
    ...sanitize(data),
    imageUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  })
  if (imagemFile) {
    try {
      const url = await uploadImagem(imagemFile, docRef.id)
      await updateDoc(docRef, { imageUrl: url })
    } catch (e) {
      console.warn('Upload de imagem falhou:', e)
    }
  }
  return docRef
}

export async function updateProduto(id, data, imagemFile) {
  const fields = { ...sanitize(data), updatedAt: serverTimestamp() }
  if (imagemFile) {
    try {
      fields.imageUrl = await uploadImagem(imagemFile, id)
    } catch (e) {
      console.warn('Upload de imagem falhou:', e)
    }
  }
  return updateDoc(doc(db, COL, id), fields)
}

export async function deleteProduto(id) {
  return deleteDoc(doc(db, COL, id))
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
