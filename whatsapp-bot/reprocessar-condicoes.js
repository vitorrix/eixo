// Reprocessa as ofertas JÁ GRAVADAS com a regra de condição (Lacrado / CPO / Semi-novo).
//   node reprocessar-condicoes.js            -> TESTE (nada é gravado)
//   node reprocessar-condicoes.js --apply    -> backup JSON + grava
// CPO sai do nome do modelo e vira condição; a condição entra no docId (cauda
// NOVO/SEMINOVO/CPO). Mesmo fornecedor/config/cor/condição repetidos: fica a cotação
// mais recente. Ofertas já processadas pela regra nova (condicaoOrigem definido) não são tocadas.
import { mkdirSync, writeFileSync } from 'fs'
import { buildDocId } from './src/mapper.js'
import { db, registrarCondicaoRevisao } from './src/firestoreWriter.js'
import { decidirCondicao, separarCpo } from '../src/shared/utils/condicoes.js'

const APPLY = process.argv.includes('--apply')
const millis = o => o.quotedAt?.toMillis?.() || 0

const [snap, fSnap] = await Promise.all([db.collection('ofertas').get(), db.collection('fornecedores').get()])
const forn = new Map(fSnap.docs.map(d => [d.id, d.data()]))
const docs = snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }))
console.log(`${docs.length} ofertas lidas. Modo: ${APPLY ? 'APLICAR' : 'TESTE (nada será gravado)'}\n`)

const itens = docs.map(d => {
  const o = d.data
  if (o.condicaoOrigem !== undefined) return { ...d, pulou: true, mudou: false, newDocId: d.id, newData: o, cond: o.condicao }
  const { nome, cpo } = separarCpo(o.produtoNome)
  const f = forn.get(o.fornecedorId) || {}
  const dec = decidirCondicao({
    texto: o.sourceText, produtoBruto: cpo ? `${nome} CPO` : nome, produtoNome: nome, capacidade: o.capacidade, preco: o.preco,
    padraoAprendido: f.condicaoPadraoLista, padraoCadastro: f.condicao, seminovoIA: o.seminovo === true,
  })
  const fornecedorKey = o.fornecedorId || `raw:${o.fornecedorPhone || 'desconhecido'}`
  const newDocId = buildDocId({ fornecedorKey, produtoNome: nome, variante: o.variante, condicao: dec.condicao })
  const newData = { ...o, produtoNome: nome, produtoNomeLower: nome.toLowerCase(), condicao: dec.condicao, condicaoOrigem: dec.origem, seminovo: dec.condicao === 'seminovo' }
  return { ...d, pulou: false, mudou: true, newDocId, newData, cond: dec.condicao, origem: dec.origem, cpoNoNome: cpo }
})

const grupos = new Map()
for (const it of itens) { if (!grupos.has(it.newDocId)) grupos.set(it.newDocId, []); grupos.get(it.newDocId).push(it) }
const ops = []
let renomeados = 0, noLugar = 0, descartados = 0
for (const [newDocId, grupo] of grupos) {
  const venc = [...grupo].sort((a, b) => (millis(b.data) - millis(a.data)) || ((a.id === newDocId ? -1 : 0) - (b.id === newDocId ? -1 : 0)))[0]
  grupo.filter(g => g !== venc).forEach(p => { descartados++; ops.push({ tipo: 'delete', ref: p.ref }) })
  if (!venc.mudou) continue
  if (venc.id === newDocId) { noLugar++; ops.push({ tipo: 'update', ref: venc.ref, data: venc.newData }) }
  else { renomeados++; ops.push({ tipo: 'set', ref: db.collection('ofertas').doc(newDocId), data: venc.newData }); ops.push({ tipo: 'delete', ref: venc.ref }) }
}

const sobreviventes = [...grupos.values()].map(g => [...g].sort((a, b) => millis(b.data) - millis(a.data))[0])
const cont = {}; sobreviventes.forEach(i => { const k = i.cond || 'sem condição'; cont[k] = (cont[k] || 0) + 1 })
const origens = {}; sobreviventes.filter(i => !i.pulou).forEach(i => { const k = i.origem || 'nenhuma'; origens[k] = (origens[k] || 0) + 1 })
const revisao = new Map()
sobreviventes.filter(i => !i.cond).forEach(i => {
  const k = i.data.fornecedorId || i.data.fornecedorNome
  const x = revisao.get(k) || { fornecedorId: i.data.fornecedorId || '', fornecedorNome: i.data.fornecedorNome || '', n: 0, exemplo: '' }
  x.n++; if (!x.exemplo) x.exemplo = `${i.newData.produtoNome} ${i.data.capacidade || ''} — R$ ${i.data.preco}`; revisao.set(k, x)
})

console.log('Resumo')
console.log(`- Já processadas pela regra nova (puladas): ${itens.filter(i => i.pulou).length}`)
console.log(`- Condição final (após colisões):`, JSON.stringify(cont))
console.log(`- De onde veio:`, JSON.stringify(origens))
console.log(`- CPO tirado do nome do modelo: ${itens.filter(i => i.cpoNoNome).length}`)
console.log(`- docId novo: ${renomeados} · atualizadas no lugar: ${noLugar} · descartadas por colisão: ${descartados}`)
console.log(`- Fornecedores na fila de revisão de condição: ${revisao.size}`)
;[...revisao.values()].sort((a, b) => b.n - a.n).slice(0, 12).forEach(x => console.log(`    ${String(x.n).padStart(4)}  ${x.fornecedorNome}`))

if (!APPLY) { console.log('\nTESTE concluído — nada foi gravado. Rode com --apply para aplicar (faz backup antes).'); process.exit(0) }

mkdirSync('backups', { recursive: true })
const arq = `backups/ofertas-antes-condicao-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(arq, JSON.stringify(docs.map(d => ({ id: d.id, ...d.data })), (k, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)))
console.log(`\nBackup salvo em ${arq} (${docs.length} ofertas)`)
let batch = db.batch(), n = 0, total = 0
const flush = async () => { if (n) { await batch.commit(); total += n; batch = db.batch(); n = 0 } }
for (const op of ops) {
  if (op.tipo === 'delete') batch.delete(op.ref); else if (op.tipo === 'set') batch.set(op.ref, op.data); else batch.update(op.ref, op.data)
  if (++n >= 400) await flush()
}
await flush()
console.log(`${total} operações gravadas.`)
for (const x of revisao.values()) await registrarCondicaoRevisao({ fornecedorId: x.fornecedorId, fornecedorNome: x.fornecedorNome, exemplo: x.exemplo }, x.n)
console.log(`${revisao.size} fornecedores enviados para a fila de revisão de condição.`)
process.exit(0)
