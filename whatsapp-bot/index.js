import { readFileSync } from 'fs'
import { connect } from './src/connection.js'
import { mapMessageToOfertas } from './src/mapper.js'
import { upsertOferta } from './src/firestoreWriter.js'

const groups = JSON.parse(
  readFileSync(new URL('./config/groups.json', import.meta.url))
)

async function handleMessages(sock, messages) {
  for (const msg of messages) {
    if (!msg.message) continue

    const jid = msg.key.remoteJid
    const groupMeta = groups[jid]
    if (!groupMeta) continue // ignora grupos não mapeados em config/groups.json

    const text = msg.message.conversation
      || msg.message.extendedTextMessage?.text
      || ''
    if (!text) continue

    const quotedAt = new Date((Number(msg.messageTimestamp) || Date.now() / 1000) * 1000)
    const ofertas = mapMessageToOfertas(text, quotedAt, groupMeta)

    for (const { docId, data } of ofertas) {
      try {
        await upsertOferta(docId, data)
        console.log(`[ingest] ${data.produtoNome} ${data.variante} — R$ ${data.preco} (${data.fornecedorNome})`)
      } catch (err) {
        console.error('Erro ao gravar oferta:', err)
      }
    }
  }
}

connect(handleMessages)
