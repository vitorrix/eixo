// Script avulso: roda uma vez para listar as comunidades/grupos que este número
// participa, com JID e nome — usado para preencher config/groups.json manualmente.
import { connect } from './connection.js'

const sock = await connect()

sock.ev.on('connection.update', async ({ connection }) => {
  if (connection !== 'open') return

  const groups = await sock.groupFetchAllParticipating()
  console.log('\nComunidades/grupos encontrados:\n')
  for (const g of Object.values(groups)) {
    console.log(`${g.id}  —  ${g.subject}`)
  }
  process.exit(0)
})
