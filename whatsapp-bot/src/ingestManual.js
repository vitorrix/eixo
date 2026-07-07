// Backfill manual: usado quando uma mensagem chegou num grupo enquanto o bot
// estava desligado (ou com sessão corrompida). Cole o texto da lista aqui e
// ele processa com a mesma lógica (parser + mapper) usada nas mensagens ao
// vivo, gravando no Firestore.
//
// Uso: node src/ingestManual.js "<fornecedor>" "<texto>" ["<data ISO, ex 2026-07-07T08:58:00>"] [--dry-run]
import { readFileSync } from 'fs'
import { mapMessageToOfertas } from './mapper.js'
import { upsertOferta } from './firestoreWriter.js'

const groups = JSON.parse(
  readFileSync(new URL('../config/groups.json', import.meta.url))
)

const args = process.argv.slice(2).filter(a => a !== '--dry-run')
const dryRun = process.argv.includes('--dry-run')
const [fornecedorQuery, textoArg, dataIso] = args

if (!fornecedorQuery || !textoArg) {
  console.error('Uso: node src/ingestManual.js "<fornecedor>" "<texto ou @caminho/arquivo.txt>" ["<data ISO>"] [--dry-run]')
  process.exit(1)
}

// Aceita "@arquivo.txt" pra evitar problemas de escaping de emoji/quebras de linha no shell.
const texto = textoArg.startsWith('@') ? readFileSync(textoArg.slice(1), 'utf8') : textoArg

function findGroupMeta(query) {
  if (groups[query]) return groups[query]
  const q = query.toLowerCase()
  for (const [jid, meta] of Object.entries(groups)) {
    if (jid.startsWith('_')) continue
    if ((meta.fornecedorNome || '').toLowerCase().includes(q)) return meta
  }
  return null
}

const groupMeta = findGroupMeta(fornecedorQuery)
if (!groupMeta) {
  console.error(`Fornecedor "${fornecedorQuery}" não encontrado em config/groups.json.`)
  process.exit(1)
}

const quotedAt = dataIso ? new Date(dataIso) : new Date()
const ofertas = await mapMessageToOfertas(texto, quotedAt, groupMeta)

if (!ofertas.length) {
  console.log('Nenhuma oferta reconhecida no texto informado.')
  process.exit(0)
}

for (const { docId, data } of ofertas) {
  if (dryRun) {
    console.log(`[dry-run] ${data.produtoNome} ${data.variante} — R$ ${data.preco} (${data.fornecedorNome}) @ ${quotedAt.toISOString()}`)
    continue
  }
  await upsertOferta(docId, data)
  console.log(`[ingest manual] ${data.produtoNome} ${data.variante} — R$ ${data.preco} (${data.fornecedorNome}) @ ${quotedAt.toISOString()}`)
}
process.exit(0)
