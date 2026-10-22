// Relatório em MODO TESTE (só leitura — não grava nada): aplica o dicionário de
// cores (dicionario-cores.json) nas ofertas dos últimos N dias e mostra, por
// fornecedor, o que seria reconhecido e o que não seria.
//   node relatorio-cores-dicionario.js [dias=7] [--md arquivo.md]
import { writeFileSync } from 'fs'
import { db } from './src/firestoreWriter.js'
import {
  normalizarCor, normalizarTexto, modeloExiste, buscarModelo, NOMES_MODELOS,
} from '../src/shared/utils/dicionarioCores.js'

const dias = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 7
const mdIdx = process.argv.indexOf('--md')
const mdPath = mdIdx > 0 ? process.argv[mdIdx + 1] : `relatorio-cores-${dias}d.md`

const limite = Date.now() - dias * 24 * 3600 * 1000
const snap = await db.collection('ofertas').get()
const ofertas = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(o => (o.quotedAt?.toMillis?.() || 0) >= limite)

console.log(`${ofertas.length} ofertas dos últimos ${dias} dias (de ${snap.size} no total). Nada será gravado.\n`)

const forn = new Map()      // fornecedor -> contadores
const modelosFora = new Map() // modelo -> { n, fornecedores:Set }
const aliasUsados = new Map() // texto da lista -> { oficial, n } (só quando o nome difere do oficial)
const get = nome => {
  if (!forn.has(nome)) forn.set(nome, {
    total: 0, reconhecidas: 0, semCorModelo: 0, semCorNoTexto: 0,
    modeloFora: 0, naoReconhecidas: new Map(),
  })
  return forn.get(nome)
}

// sourceText é a mensagem inteira da lista; mostra só a linha que cita a cor.
function linhaDaCor(o) {
  const alvo = normalizarTexto(o.cor)
  const linhas = (o.sourceText || '').split('\n').map(l => l.trim()).filter(Boolean)
  const achou = linhas.find(l => alvo && normalizarTexto(l).includes(alvo))
  return (achou || linhas[0] || '').slice(0, 110)
}

for (const o of ofertas) {
  const f = get(o.fornecedorNome || '(sem nome)')
  f.total++
  const modelo = o.produtoNome || ''
  if (!modeloExiste(modelo)) {
    f.modeloFora++
    const m = modelosFora.get(modelo) || { n: 0, fornecedores: new Set() }
    m.n++; m.fornecedores.add(o.fornecedorNome || '(sem nome)')
    modelosFora.set(modelo, m)
    continue
  }
  const mod = buscarModelo(modelo)
  if (mod.nome !== modelo) {
    const a = aliasUsados.get(modelo) || { oficial: mod.nome, n: 0 }
    a.n++; aliasUsados.set(modelo, a)
  }
  const oficial = normalizarCor(modelo, o.cor)
  if (oficial === '') { f.semCorModelo++; continue }
  if (oficial) { f.reconhecidas++; continue }
  // Não bateu com a cor gravada (que já passou por colorMap.js, que traduz/funde
  // nomes — ver nota no relatório). Sem cor gravada = a lista não informou cor.
  if (!(o.cor || '').trim()) { f.semCorNoTexto++; continue }
  const chave = `${modelo} | ${o.cor}`
  const x = f.naoReconhecidas.get(chave) || { n: 0, modelo, cor: o.cor, exemplo: linhaDaCor(o), cores: (buscarModelo(modelo)?.cores || []).map(c => c.nome) }
  x.n++
  f.naoReconhecidas.set(chave, x)
}

const linhas = []
const L = s => linhas.push(s)
const pct = (a, b) => b ? `${Math.round(100 * a / b)}%` : '—'

const tot = { total: 0, reconhecidas: 0, semCorModelo: 0, semCorNoTexto: 0, modeloFora: 0, naoRec: 0 }
for (const f of forn.values()) {
  tot.total += f.total; tot.reconhecidas += f.reconhecidas
  tot.semCorModelo += f.semCorModelo; tot.semCorNoTexto += f.semCorNoTexto; tot.modeloFora += f.modeloFora
  tot.naoRec += [...f.naoReconhecidas.values()].reduce((s, x) => s + x.n, 0)
}

L(`# Relatório de cores — dicionário x ofertas dos últimos ${dias} dias`)
L(`Modo teste: nada foi gravado. ${ofertas.length} ofertas, ${forn.size} fornecedores, ${NOMES_MODELOS.length} modelos no dicionário.`)
L('Nota: a cor testada é a GRAVADA na oferta, que já passou por colorMap.js (ex: citrus -> "Cítrico"). Na integração o dicionário recebe o texto cru da lista, antes dessa tradução, então o reconhecimento real pode ser maior.\n')
L('## Resumo geral')
L(`- Cor reconhecida pela cor gravada: **${tot.reconhecidas}** (${pct(tot.reconhecidas, tot.total)})`)
L(`- Modelo "Sem cor" (cor ignorada): **${tot.semCorModelo}** (${pct(tot.semCorModelo, tot.total)})`)
L(`- Sem cor informada na lista (modelo com cores): **${tot.semCorNoTexto}** (${pct(tot.semCorNoTexto, tot.total)})`)
L(`- Cor NÃO reconhecida: **${tot.naoRec}** (${pct(tot.naoRec, tot.total)})`)
L(`- Modelo fora do dicionário: **${tot.modeloFora}** (${pct(tot.modeloFora, tot.total)})\n`)

L('## Por fornecedor')
L('| Fornecedor | Ofertas | Reconhecidas | Sem cor (modelo) | Sem cor na lista | Não reconhecidas | Modelo fora |')
L('|---|---:|---:|---:|---:|---:|---:|')
const ordenados = [...forn.entries()].sort((a, b) => b[1].total - a[1].total)
for (const [nome, f] of ordenados) {
  const nr = [...f.naoReconhecidas.values()].reduce((s, x) => s + x.n, 0)
  L(`| ${nome} | ${f.total} | ${f.reconhecidas} | ${f.semCorModelo} | ${f.semCorNoTexto} | ${nr} | ${f.modeloFora} |`)
}

L('\n## Cores não reconhecidas (com o texto original)')
let algum = false
for (const [nome, f] of ordenados) {
  if (!f.naoReconhecidas.size) continue
  algum = true
  L(`\n### ${nome}`)
  for (const x of [...f.naoReconhecidas.values()].sort((a, b) => b.n - a.n)) {
    L(`- **${x.modelo}** — cor "${x.cor}" (${x.n}x) · cores do modelo: ${x.cores.join(', ') || '—'}`)
    L(`  - linha: \`${x.exemplo}\``)
  }
}
if (!algum) L('\nNenhuma.')

L('\n## Nomes de modelo reconhecidos por regra/alias (para você revisar)')
L('Texto como veio da lista -> modelo oficial do dicionário. Só aparecem nomes que diferem do oficial.\n')
const porOficial = new Map()
for (const [txt, a] of aliasUsados) {
  const g = porOficial.get(a.oficial) || []
  g.push(`${txt} (${a.n})`); porOficial.set(a.oficial, g)
}
for (const [of, lista] of [...porOficial.entries()].sort()) L(`- **${of}** ← ${lista.join(' · ')}`)

L('\n## Modelos que ainda não existem no dicionário')
if (!modelosFora.size) L('\nNenhum.')
for (const [modelo, m] of [...modelosFora.entries()].sort((a, b) => b[1].n - a[1].n)) {
  L(`- **${modelo || '(vazio)'}** — ${m.n} ofertas · ${[...m.fornecedores].slice(0, 6).join(', ')}${m.fornecedores.size > 6 ? '…' : ''}`)
}

writeFileSync(mdPath, linhas.join('\n') + '\n')
console.log(linhas.join('\n'))
console.log(`\nRelatório salvo em ${mdPath}`)
process.exit(0)
