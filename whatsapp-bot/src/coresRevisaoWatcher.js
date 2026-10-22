// Aplica de volta, nas ofertas, as decisões da fila de revisão de cores
// (coresRevisao). O Eixo marca o item como status 'decidida' com a corOficial
// escolhida (ou 'ignorada'); aqui o bot:
//   1) guarda o apelido (configuracoes/coresExtras) pra listas futuras;
//   2) corrige as ofertas daquele modelo+texto que estavam sem cor (corRevisao);
//   3) marca o item como 'aplicada'.
// A cor faz parte do docId da oferta: grava o doc novo e apaga o antigo, e se já
// existir uma oferta do mesmo fornecedor/config com essa cor, fica a de cotação
// mais recente.
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestoreWriter.js'
import { buildDocId } from './mapper.js'
import { adicionarApelidoCor, normalizarTexto } from '../../src/shared/utils/dicionarioCores.js'

const EXTRAS_REF = () => db.collection('configuracoes').doc('coresExtras')
const emProcessamento = new Set()

// Chamado na partida: recarrega os apelidos decididos antes do bot reiniciar.
export async function carregarApelidosExtras() {
  const snap = await EXTRAS_REF().get()
  if (!snap.exists) return
  let n = 0
  for (const [modelo, cores] of Object.entries(snap.data())) {
    for (const [cor, apelidos] of Object.entries(cores || {})) {
      for (const a of apelidos || []) if (adicionarApelidoCor(modelo, cor, a)) n++
    }
  }
  console.log(`[cores] ${n} apelido(s) extra(s) carregado(s) da revisão.`)
}

async function aplicarDecisao(doc) {
  const d = doc.data()
  const { modelo, textoCor, corOficial } = d
  // 1) apelido persistente (campo com ponto não serve: nomes de modelo/cor têm '.' e '"')
  const extras = (await EXTRAS_REF().get()).data() || {}
  const cores = extras[modelo] || {}
  const atual = new Set(cores[corOficial] || [])
  atual.add(normalizarTexto(textoCor))
  await EXTRAS_REF().set({ [modelo]: { ...cores, [corOficial]: [...atual] } }, { merge: true })
  adicionarApelidoCor(modelo, corOficial, textoCor)

  // 2) ofertas pendentes desse modelo + texto
  const snap = await db.collection('ofertas')
    .where('modeloOficial', '==', modelo)
    .where('corOriginal', '==', textoCor)
    .get()
  const pendentes = snap.docs.filter(o => o.data().corRevisao === true)
  let corrigidas = 0
  for (const o of pendentes) {
    const x = o.data()
    const variante = [x.capacidade, x.ram, x.tamanho, x.origem, corOficial].filter(Boolean).join(' ')
    const fornecedorKey = x.fornecedorId || `raw:${x.fornecedorPhone || 'desconhecido'}`
    const novoId = buildDocId({ fornecedorKey, produtoNome: x.produtoNome, variante, seminovo: x.seminovo })
    const novo = { ...x, cor: corOficial, variante, corRevisao: false }
    if (novoId === o.id) { await o.ref.update({ cor: corOficial, variante, corRevisao: false }); corrigidas++; continue }
    const existente = await db.collection('ofertas').doc(novoId).get()
    const maisRecente = !existente.exists || (x.quotedAt?.toMillis?.() || 0) >= (existente.data().quotedAt?.toMillis?.() || 0)
    if (maisRecente) await db.collection('ofertas').doc(novoId).set(novo)
    await o.ref.delete()
    corrigidas++
  }
  await doc.ref.update({ status: 'aplicada', aplicadaEm: FieldValue.serverTimestamp(), ofertasCorrigidas: corrigidas })
  console.log(`[cores] "${textoCor}" em ${modelo} -> ${corOficial}: ${corrigidas} oferta(s) corrigida(s).`)
}

export function watchCoresRevisao() {
  return db.collection('coresRevisao').where('status', '==', 'decidida').onSnapshot(snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed' || emProcessamento.has(ch.doc.id)) continue
      emProcessamento.add(ch.doc.id)
      aplicarDecisao(ch.doc)
        .catch(err => console.error('[cores] erro ao aplicar decisão:', err))
        .finally(() => emProcessamento.delete(ch.doc.id))
    }
  }, err => console.error('[cores] watcher de revisão caiu:', err))
}
