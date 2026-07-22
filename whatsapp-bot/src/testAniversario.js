// Script avulso: manda uma arte de aniversário de teste pra um número, sem
// depender de data real de aniversário nem do agendamento das 10h. Mesmo
// padrão do discoverGroups.js — conecta uma vez, roda, sai.
//
// Uso: node --env-file=.env src/testAniversario.js "<telefone com DDI>" "<Nome do cliente>"
// Ex.:  node --env-file=.env src/testAniversario.js "5511999999999" "Maria Jandira Mendes de Oliveira"
import { connect } from './connection.js'
import { enviarAniversario } from './aniversario.js'

const [, , telefone, nome] = process.argv
if (!telefone || !nome) {
  console.error('Uso: node --env-file=.env src/testAniversario.js "<telefone com DDI>" "<Nome>"')
  process.exit(1)
}

await connect(null, async (sock) => {
  try {
    await enviarAniversario(sock, { nome, jid: `${telefone}@s.whatsapp.net` })
    console.log(`Arte de teste enviada para ${telefone}.`)
  } catch (err) {
    console.error('Falha ao enviar teste:', err)
  }
  process.exit(0)
})
