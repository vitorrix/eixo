// Relatório em MODO TESTE (só leitura): aplica a regra de condição (Lacrado / CPO /
// Semi-novo) nas ofertas dos últimos N dias e compara com o que está gravado hoje.
//   node relatorio-condicoes.js [dias=7] [--md arquivo.md]
import { writeFileSync } from 'fs'
import { db } from './src/firestoreWriter.js'
import { normalizarTexto } from '../src/shared/utils/dicionarioCores.js'
import {
  CONDICOES, condicaoDoTexto, condicaoDaLinha, condicaoPadraoDoFornecedor,
} from '../src/shared/utils/condicoes.js'

const dias = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 7
const mdIdx = process.argv.indexOf('--md')
const mdPath = mdIdx > 0 ? process.argv[mdIdx + 1] : `relatorio-condicoes-${dias}d.md`

const limite = Date.now() - dias * 24 * 3600 * 1000
const [snap, fSnap] = await Promise.all([db.collection('ofertas').get(), db.collection('fornecedores').get()])
const ofertas = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => (o.quotedAt?.toMillis?.() || 0) >= limite)
const padraoPorFornecedor = new Map(fSnap.docs.map(d => [d.id, d.data().condicao || '']))
console.log(`${ofertas.length} ofertas dos últimos ${dias} dias. Nada será gravado.\n`)

// Acha, na mensagem da lista, a linha da oferta: pelo preço (+ número do modelo/capacidade).
function acharLinha(o) {
  const linhas = (o.sourceText || '').split('\n')
  const p = Math.round(Number(o.preco))
  if (!p) return { linhas, idx: -1 }
  const milhar = Math.floor(p / 1000), resto = String(p % 1000).padStart(3, '0')
  const formatos = [String(p), `${milhar}.${resto}`, `${milhar},${resto}`, `${milhar} ${resto}`]
  const temPreco = l => formatos.some(f => new RegExp(`(^|[^\\d])${f.replace('.', '\\.')}([^\\d]|$)`).test(l))
  let cand = linhas.map((l, i) => i).filter(i => temPreco(linhas[i]))
  if (cand.length > 1) {
    const modeloTok = normalizarTexto(o.produtoNome).split(' ').find(t => /\d/.test(t))
    const filtradas = cand.filter(i => modeloTok && normalizarTexto(linhas[i]).split(' ').includes(modeloTok))
    if (filtradas.length) cand = filtradas
  }
  if (cand.length > 1 && o.capacidade) {
    const cap = normalizarTexto(o.capacidade).replace(/ /g, '')
    const f2 = cand.filter(i => normalizarTexto(linhas[i]).replace(/ /g, '').includes(cap.replace(/gb|tb/, '')))
    if (f2.length) cand = f2
  }
  return { linhas, idx: cand.length ? cand[0] : -1 }
}

const decisoes = []   // { o, condicao, origem, gravado, ctx }
const forn = new Map()
const get = n => { if (!forn.has(n)) forn.set(n, { total: 0, lacrado: 0, cpo: 0, seminovo: 0, indef: 0, semLinha: 0, difere: 0 }); return forn.get(n) }
const motivosSemi = {}
const matriz = {}   // gravado -> novo
const origens = { linha: 0, secao: 0, modelo: 0, fornecedor: 0, nenhuma: 0 }
const exemplos = { novoVirouSemi: [], semiVirouLacrado: [], indef: [] }
const incr = (a, b) => { matriz[a] ||= {}; matriz[a][b] = (matriz[a][b] || 0) + 1 }

for (const o of ofertas) {
  const f = get(o.fornecedorNome || '(sem nome)')
  f.total++
  const { linhas, idx } = acharLinha(o)
  let condicao = null, origem = null, textoDecisao = ''
  if (/\bcpo\b/.test(normalizarTexto(o.produtoNome))) { condicao = 'cpo'; origem = 'modelo' }
  else if (idx >= 0) { ({ condicao, origem, texto: textoDecisao = '' } = condicaoDaLinha(linhas, idx)) }
  else f.semLinha++
  if (!condicao) {
    const padrao = condicaoPadraoDoFornecedor(padraoPorFornecedor.get(o.fornecedorId) || '')
    if (padrao) { condicao = padrao; origem = 'fornecedor' }
  }
  decisoes.push({ o, condicao, origem, linhas, idx })
  origens[origem || 'nenhuma']++
  const chave = condicao || 'indef'
  f[chave === 'indef' ? 'indef' : chave]++
  const gravado = o.seminovo ? 'seminovo' : 'novo'
  if (gravado === 'novo' && chave === 'seminovo') { const m = normalizarTexto(textoDecisao).match(/semi ?novos?|seminovos?|usad[oa]s?|used|vitrine|swap|open ?box|caixa aberta|asis|as is/); const k = m ? m[0].replace(/ /g, '') : '?'; motivosSemi[k] = (motivosSemi[k] || 0) + 1 }
  incr(gravado, chave)
  const difere = (gravado === 'seminovo' && chave !== 'seminovo' && chave !== 'indef') || (gravado === 'novo' && chave === 'seminovo')
  if (difere) f.difere++
  const ctx = idx >= 0 ? linhas[idx].trim().slice(0, 100) : '(linha não localizada)'
  const item = `${o.fornecedorNome} | ${o.produtoNome} ${o.capacidade || ''} R$${o.preco} | gravado: ${gravado} -> ${chave} (${origem || '-'}) | ${ctx}`
  if (gravado === 'novo' && chave === 'seminovo' && exemplos.novoVirouSemi.length < 15) exemplos.novoVirouSemi.push(item)
  if (gravado === 'seminovo' && (chave === 'lacrado' || chave === 'cpo') && exemplos.semiVirouLacrado.length < 15) exemplos.semiVirouLacrado.push(item)
  if (chave === 'indef' && exemplos.indef.length < 12) exemplos.indef.push(item)
  if (chave === 'indef' && gravado === 'seminovo' && (exemplos.semiIndef ||= []).length < 14) exemplos.semiIndef.push(`${item}\n    cabeçalhos: ${linhas.filter(l => l.trim().length < 90 && /semi|usad|swap|vitrine|open|cpo|lacrad|asis|as is/i.test(l)).slice(0,4).map(l=>l.trim()).join(' || ')}`)
}

// Padrão aprendido por fornecedor: o que ele manda quase sempre (>=90% e >=15 ofertas
// decididas por linha/seção/modelo). Só vale para o que ficou indeterminado.
const grupo = c => (c === 'seminovo' ? 'seminovo' : 'lacrado')   // CPO conta como lacrado
const perfil = new Map()
for (const d of decisoes) {
  if (!d.condicao || d.origem === 'fornecedor') continue
  const k = d.o.fornecedorNome || '(sem nome)'
  const x = perfil.get(k) || { lacrado: 0, seminovo: 0 }
  x[grupo(d.condicao)]++; perfil.set(k, x)
}
const aprendido = new Map()
for (const [k, x] of perfil) {
  const n = x.lacrado + x.seminovo
  if (n >= 15 && x.lacrado / n >= 0.9) aprendido.set(k, 'lacrado')
  else if (n >= 15 && x.seminovo / n >= 0.9) aprendido.set(k, 'seminovo')
}
let resolvidasPorPerfil = 0
const semPerfil = new Map()
for (const d of decisoes) {
  if (d.condicao) continue
  const k = d.o.fornecedorNome || '(sem nome)'
  if (aprendido.has(k)) resolvidasPorPerfil++
  else semPerfil.set(k, (semPerfil.get(k) || 0) + 1)
}

const L = []; const P = s => L.push(s)
const tot = ofertas.length
const pct = n => `${Math.round(100 * n / tot)}%`
const somar = k => [...forn.values()].reduce((s, f) => s + f[k], 0)
P(`# Relatório de condição — ofertas dos últimos ${dias} dias`)
P(`Modo teste: nada foi gravado. ${tot} ofertas, ${forn.size} fornecedores.\n`)
P('## Resultado da regra nova')
for (const k of ['lacrado', 'cpo', 'seminovo']) P(`- ${CONDICOES[k]}: **${somar(k)}** (${pct(somar(k))})`)
P(`- Indeterminada (iria para revisão): **${somar('indef')}** (${pct(somar('indef'))})\n`)
P('## De onde veio a decisão')
P(`- Linha da própria oferta: ${origens.linha} · Cabeçalho da seção: ${origens.secao} · Nome do modelo (CPO): ${origens.modelo} · Padrão do fornecedor: ${origens.fornecedor} · Sem decisão: ${origens.nenhuma}`)
P(`- Linha da oferta não localizada na mensagem: ${somar('semLinha')}\n`)
P('## Comparação com o que está gravado hoje (novo / semi-novo)')
P('| Gravado hoje | → Lacrado | → CPO | → Semi-novo | → Indeterminada |')
P('|---|---:|---:|---:|---:|')
for (const g of ['novo', 'seminovo']) P(`| ${g === 'novo' ? 'Novo' : 'Semi-novo'} | ${matriz[g]?.lacrado || 0} | ${matriz[g]?.cpo || 0} | ${matriz[g]?.seminovo || 0} | ${matriz[g]?.indef || 0} |`)
P('\n## Por que "novo" virou "semi-novo" (palavra que decidiu)')
P(JSON.stringify(motivosSemi))
P('\n## Padrão aprendido por fornecedor (para o que ficou indeterminado)')
P(`- Fornecedores com padrão claro (>=90% de >=15 ofertas decididas): ${aprendido.size} de ${forn.size}`)
P(`- Ofertas indeterminadas que o padrão aprendido resolveria: **${resolvidasPorPerfil}** de ${somar('indef')}`)
P(`- Continuam indeterminadas (fornecedor sem padrão): **${somar('indef') - resolvidasPorPerfil}**`)
for (const [k, v] of [...semPerfil.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) P(`  - ${k}: ${v} sem padrão`)
P('\n## Por fornecedor')
P('| Fornecedor | Ofertas | Lacrado | CPO | Semi-novo | Indeterminada | Difere do gravado |')
P('|---|---:|---:|---:|---:|---:|---:|')
for (const [n, f] of [...forn.entries()].sort((a, b) => b[1].total - a[1].total)) P(`| ${n} | ${f.total} | ${f.lacrado} | ${f.cpo} | ${f.seminovo} | ${f.indef} | ${f.difere} |`)
P('\n## Exemplos: gravado como NOVO, regra nova diz SEMI-NOVO')
exemplos.novoVirouSemi.forEach(e => P('- ' + e))
P('\n## Exemplos: gravado como SEMI-NOVO, regra nova diz LACRADO/CPO')
exemplos.semiVirouLacrado.forEach(e => P('- ' + e))
P('\n## Exemplos: gravado SEMI-NOVO e regra nova INDETERMINADA');
(exemplos.semiIndef || []).forEach(e => P('- ' + e))
P('\n## Exemplos de indeterminada')
exemplos.indef.forEach(e => P('- ' + e))

writeFileSync(mdPath, L.join('\n') + '\n')
console.log(L.slice(0, 22).join('\n'))
console.log(`\nRelatório salvo em ${mdPath}`)
process.exit(0)
