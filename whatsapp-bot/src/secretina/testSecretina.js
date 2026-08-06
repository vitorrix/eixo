// Script avulso: simula uma mensagem recebida do secretina sem precisar
// mandar de verdade pelo WhatsApp — conecta uma vez, processa o texto como se
// tivesse chegado desse número, manda a resposta real de volta, sai. Mesmo
// padrão do testAniversario.js.
//
// Uso: node --env-file=.env src/secretina/testSecretina.js "<telefone com DDI>" "<mensagem>"
// Ex.:  node --env-file=.env src/secretina/testSecretina.js "5511995844837" "gastei 1,45 na padaria e paguei no débito"
import { connect } from '../connection.js'
import { handleSecretinaMessage } from './handler.js'

const [, , telefone, ...resto] = process.argv
const texto = resto.join(' ')
if (!telefone || !texto) {
  console.error('Uso: node --env-file=.env src/secretina/testSecretina.js "<telefone com DDI>" "<mensagem>"')
  process.exit(1)
}

await connect(null, async (sock) => {
  try {
    await handleSecretinaMessage(sock, `${telefone}@s.whatsapp.net`, texto)
    console.log('Processado — confira a resposta no WhatsApp e o lançamento no app.')
  } catch (err) {
    console.error('Falha no teste:', err)
  }
  process.exit(0)
})
