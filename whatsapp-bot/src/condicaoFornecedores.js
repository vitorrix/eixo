// Padrão de condição por fornecedor decidido na tela de revisão (campo
// fornecedores.condicaoPadraoLista: 'lacrado' | 'seminovo'). Mantido em memória por
// um listener do Firestore, pra o mapper consultar de forma síncrona a cada oferta.
import { db } from './firestoreWriter.js'

const padroes = new Map()   // fornecedorId -> 'lacrado' | 'seminovo'
let iniciado = false

export function condicaoPadraoDe(fornecedorId) {
  return fornecedorId ? padroes.get(fornecedorId) || null : null
}

export function definirCondicaoPadraoLocal(fornecedorId, condicao) {
  if (condicao) padroes.set(fornecedorId, condicao); else padroes.delete(fornecedorId)
}

export function iniciarCacheCondicaoFornecedores() {
  if (iniciado) return
  iniciado = true
  db.collection('fornecedores').onSnapshot(snap => {
    snap.docs.forEach(d => definirCondicaoPadraoLocal(d.id, d.data().condicaoPadraoLista))
  }, err => console.error('[condicao] listener de fornecedores caiu:', err))
}
