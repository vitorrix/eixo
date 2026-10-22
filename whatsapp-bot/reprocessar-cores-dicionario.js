// Reprocessa as ofertas JÁ GRAVADAS com o dicionário de cores (mesma regra do bot:
// aplicarCor). Modelo fora do dicionário não é tocado.
//   node reprocessar-cores-dicionario.js            -> TESTE (nada é gravado)
//   node reprocessar-cores-dicionario.js --apply    -> faz backup JSON e grava
//
// A cor faz parte do identificador da oferta (variante), então trocar a cor muda o
// docId: grava o doc novo e apaga o antigo. Se duas ofertas do mesmo fornecedor
// caem no mesmo docId, fica a de cotação mais recente (a outra é apagada).
import { mkdirSync, writeFileSync } from 'fs'
import { buildDocId } from './src/mapper.js'
import { db, registrarCorRevisao } from './src/firestoreWriter.js'
import { aplicarCor, normalizarCor, buscarModelo } from '../src/shared/utils/dicionarioCores.js'
import { chavesQueGeram } from './src/colorMap.js'

const APPLY = process.argv.includes('--apply')
const millis = o => o.quotedAt?.toMillis?.() || 0

const snap = await db.collection('ofertas').get()
const docs = snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }))
console.log(`${docs.length} ofertas lidas. Modo: ${APPLY ? 'APLICAR' : 'TESTE (nada será gravado)'}\n`)

// 1) novo estado de cada oferta
const itens = docs.map(d => {
  const o = d.data
  let r = aplicarCor(o.produtoNome, o.cor)
  // A cor gravada já passou por colorMap.js (silver -> "Prateado" etc). Se o dicionário
  // não reconhece, tenta os textos crus que geram esse nome; só aceita se TODOS os que
  // reconhecem apontam pra mesma cor oficial (senão é ambíguo -> revisão).
  if (r.estado === 'revisar') {
    const achadas = new Set(chavesQueGeram(o.cor).map(k => normalizarCor(o.produtoNome, k)).filter(Boolean))
    if (achadas.size === 1) r = { estado: 'oficial', modeloOficial: buscarModelo(o.produtoNome).nome, cor: [...achadas][0] }
  }
  if (r.estado === 'modelo-fora') return { ...d, estado: 'modelo-fora', mudou: false, newDocId: d.id, newData: o }
  const corOriginal = o.corOriginal ?? (o.cor || '')
  const variante = [o.capacidade, o.ram, o.tamanho, o.origem, r.cor].filter(Boolean).join(' ')
  const fornecedorKey = o.fornecedorId || `raw:${o.fornecedorPhone || 'desconhecido'}`
  const newDocId = buildDocId({ fornecedorKey, produtoNome: o.produtoNome, variante, seminovo: o.seminovo })
  const newData = { ...o, cor: r.cor, variante, corOriginal, corRevisao: r.estado === 'revisar', modeloOficial: r.modeloOficial }
  const mudou = newDocId !== d.id || r.cor !== (o.cor || '') || o.modeloOficial !== r.modeloOficial
    || o.corRevisao !== newData.corRevisao || o.corOriginal !== corOriginal
  return { ...d, estado: r.estado, mudou, newDocId, newData }
})

// 2) colisões: agrupa por docId final (inclui docs que já estavam corretos)
const grupos = new Map()
for (const it of itens) {
  if (!grupos.has(it.newDocId)) grupos.set(it.newDocId, [])
  grupos.get(it.newDocId).push(it)
}
const ops = []        // { tipo: 'set'|'update'|'delete', ref, data }
let renomeados = 0, atualizadosNoLugar = 0, descartados = 0
const exemplosColisao = []
for (const [newDocId, grupo] of grupos) {
  const vencedor = [...grupo].sort((a, b) => (millis(b.data) - millis(a.data)) || ((a.id === newDocId ? -1 : 0) - (b.id === newDocId ? -1 : 0)))[0]
  grupo.filter(g => g !== vencedor).forEach(p => {
    descartados++
    if (exemplosColisao.length < 8) exemplosColisao.push(`${p.id}  (R$ ${p.data.preco}) descartado em favor de ${vencedor.id} (R$ ${vencedor.data.preco})`)
    ops.push({ tipo: 'delete', ref: p.ref })
  })
  if (!vencedor.mudou) continue
  if (vencedor.id === newDocId) { atualizadosNoLugar++; ops.push({ tipo: 'update', ref: vencedor.ref, data: vencedor.newData }) }
  else {
    renomeados++
    ops.push({ tipo: 'set', ref: db.collection('ofertas').doc(newDocId), data: vencedor.newData })
    ops.push({ tipo: 'delete', ref: vencedor.ref })
  }
}

// 3) fila de revisão (agregada por modelo + texto)
const revisao = new Map()
for (const g of grupos.values()) {
  // só conta as que sobrevivem (a de maior cotação do grupo)
  const v = [...g].sort((a, b) => millis(b.data) - millis(a.data))[0]
  if (v.estado !== 'revisar') continue
  const k = `${v.newData.modeloOficial}|${v.newData.corOriginal}`
  const x = revisao.get(k) || { modelo: v.newData.modeloOficial, textoCor: v.newData.corOriginal, n: 0, fornecedores: new Set(), exemplo: '' }
  x.n++; x.fornecedores.add(v.newData.fornecedorNome || ''); revisao.set(k, x)
}

const conta = estado => itens.filter(i => i.estado === estado).length
console.log('Resumo')
console.log(`- Modelo fora do dicionário (não tocadas): ${conta('modelo-fora')}`)
console.log(`- Cor oficial aplicada: ${conta('oficial')}`)
console.log(`- Modelo "Sem cor" (cor ''): ${conta('sem-cor-modelo')}`)
console.log(`- Sem cor na lista (cor ''): ${conta('sem-texto')}`)
console.log(`- Cor não reconhecida -> sem cor + fila de revisão: ${conta('revisar')}`)
console.log(`- Ofertas que mudam: ${itens.filter(i => i.mudou).length}  (docId novo: ${renomeados}, atualizadas no lugar: ${atualizadosNoLugar})`)
console.log(`- Descartadas por colisão (mesmo fornecedor/config/cor): ${descartados}`)
console.log(`- Itens distintos na fila de revisão: ${revisao.size}`)
if (exemplosColisao.length) { console.log('\nExemplos de colisão:'); exemplosColisao.forEach(e => console.log('  ' + e)) }
console.log('\nTop da fila de revisão:')
;[...revisao.values()].sort((a, b) => b.n - a.n).slice(0, 15).forEach(x => console.log(`  ${String(x.n).padStart(3)}x  ${x.modelo}  ←  "${x.textoCor}"  (${x.fornecedores.size} forn.)`))

if (!APPLY) { console.log('\nTESTE concluído — nada foi gravado. Rode com --apply para aplicar (faz backup antes).'); process.exit(0) }

// ── APLICAR ──
mkdirSync('backups', { recursive: true })
const arq = `backups/ofertas-antes-dicionario-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
writeFileSync(arq, JSON.stringify(docs.map(d => ({ id: d.id, ...d.data })), (k, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)))
console.log(`\nBackup salvo em ${arq} (${docs.length} ofertas)`)

let batch = db.batch(), n = 0, total = 0
const flush = async () => { if (n) { await batch.commit(); total += n; batch = db.batch(); n = 0 } }
for (const op of ops) {
  if (op.tipo === 'delete') batch.delete(op.ref)
  else if (op.tipo === 'set') batch.set(op.ref, op.data)
  else batch.update(op.ref, op.data)
  if (++n >= 400) await flush()
}
await flush()
console.log(`${total} operações gravadas.`)

for (const x of revisao.values()) {
  await registrarCorRevisao({ modelo: x.modelo, textoCor: x.textoCor, fornecedor: [...x.fornecedores][0] || '', exemplo: x.exemplo }, x.n)
}
console.log(`${revisao.size} itens enviados para a fila de revisão.`)
process.exit(0)
