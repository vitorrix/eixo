// Aplica a decisão da fila de revisão de condição (condicaoRevisao). O Eixo marca o
// item como 'decidida' com condicao 'lacrado' | 'seminovo' (ou 'ignorada'); aqui o bot:
//   1) grava o padrão no fornecedor (fornecedores.condicaoPadraoLista) — vale pras listas novas;
//   2) corrige as ofertas desse fornecedor que estavam sem condição;
//   3) marca o item como 'aplicada'.
// Condição entra no docId (cauda NOVO/SEMINOVO/CPO): ao virar semi-novo grava o doc novo e apaga o antigo.
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestoreWriter.js'
import { buildDocId } from './mapper.js'
import { definirCondicaoPadraoLocal } from './condicaoFornecedores.js'

const emProcessamento = new Set()

async function aplicar(doc) {
  const d = doc.data()
  const { fornecedorId, condicao } = d
  if (!fornecedorId || !['lacrado', 'seminovo'].includes(condicao)) {
    await doc.ref.update({ status: 'aplicada', aplicadaEm: FieldValue.serverTimestamp(), ofertasCorrigidas: 0 })
    return
  }
  await db.collection('fornecedores').doc(fornecedorId).update({ condicaoPadraoLista: condicao })
  definirCondicaoPadraoLocal(fornecedorId, condicao)

  const snap = await db.collection('ofertas').where('fornecedorId', '==', fornecedorId).get()
  let corrigidas = 0
  for (const o of snap.docs) {
    const x = o.data()
    if (x.condicao) continue
    const novoId = buildDocId({
      fornecedorKey: fornecedorId, produtoNome: x.produtoNome, variante: x.variante, condicao,
    })
    const novo = { ...x, condicao, seminovo: condicao === 'seminovo', condicaoOrigem: 'fornecedor' }
    if (novoId === o.id) { await o.ref.update({ condicao, seminovo: novo.seminovo, condicaoOrigem: 'fornecedor' }); corrigidas++; continue }
    const existente = await db.collection('ofertas').doc(novoId).get()
    if (!existente.exists || (x.quotedAt?.toMillis?.() || 0) >= (existente.data().quotedAt?.toMillis?.() || 0)) {
      await db.collection('ofertas').doc(novoId).set(novo)
    }
    await o.ref.delete(); corrigidas++
  }
  await doc.ref.update({ status: 'aplicada', aplicadaEm: FieldValue.serverTimestamp(), ofertasCorrigidas: corrigidas })
  console.log(`[condicao] ${d.fornecedorNome}: padrão ${condicao}, ${corrigidas} oferta(s) corrigida(s).`)
}

export function watchCondicaoRevisao() {
  return db.collection('condicaoRevisao').where('status', '==', 'decidida').onSnapshot(snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed' || emProcessamento.has(ch.doc.id)) continue
      emProcessamento.add(ch.doc.id)
      aplicar(ch.doc)
        .catch(err => console.error('[condicao] erro ao aplicar decisão:', err))
        .finally(() => emProcessamento.delete(ch.doc.id))
    }
  }, err => console.error('[condicao] watcher caiu:', err))
}
