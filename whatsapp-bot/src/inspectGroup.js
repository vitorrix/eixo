// Script avulso de diagnóstico: mostra metadados de JIDs específicos (passados
// como argumentos) pra identificar qual é o canal de avisos de uma comunidade.
import { connect } from './connection.js'

const jids = process.argv.slice(2)

await connect(null, async (sock) => {
  for (const jid of jids) {
    const meta = await sock.groupMetadata(jid)
    console.log(`\n${jid}`)
    console.log(`  subject: ${meta.subject}`)
    console.log(`  announce (só admin posta): ${meta.announce}`)
    console.log(`  isCommunity: ${meta.isCommunity}`)
    console.log(`  isCommunityAnnounce: ${meta.isCommunityAnnounce}`)
    console.log(`  participantes: ${meta.participants?.length}`)
  }
  process.exit(0)
})
