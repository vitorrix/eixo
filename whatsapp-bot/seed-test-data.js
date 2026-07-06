// Script avulso: grava algumas ofertas de exemplo em /ofertas usando o parser
// real, a partir de mensagens reais de fornecedor — só pra popular a tela
// #/busca do Eixo com dado de verdade antes do robô estar rodando de fato.
import { readFileSync } from 'fs'
import { mapMessageToOfertas } from './src/mapper.js'
import { upsertOferta } from './src/firestoreWriter.js'

const groups = JSON.parse(readFileSync(new URL('./config/groups.json', import.meta.url)))
const groupMeta = groups['120363407576723105@g.us'] // America Mobile 5173

const mensagens = [
  `PRONTA ENTREGA — SP

📦 Retirada ou Envio📦

🔒LACRADO🔒

📱 iPhone 17 Pro 256GB 🇺🇸
⚪Branco-R$6.500
🔵Azul-R$6.500
🟠Laranja-R$6.350

📱 iPhone 17 256GB
⚫Preto-R$5.150
⚪Branco-R$5.200
🟣Lavanda-R$5.200

⌚ Apple Watch S11 42MM Jet Black
⚫Preto-R$2.150

iPad 11 128GB WiFi
⚪Prata-R$2.500`,
  `📦 Retirada ou Envio📦

🔒LACRADO🔒

📱 iPhone 17 Pro Max 256GB🇺🇸
⚪Branco -7.050
🔵Azul-R$6.950
🟠Laranja-R$6.800`,
]

for (const texto of mensagens) {
  const ofertas = mapMessageToOfertas(texto, new Date(), groupMeta)
  for (const { docId, data } of ofertas) {
    await upsertOferta(docId, data)
    console.log(`[seed] ${data.produtoNome} ${data.variante} — R$ ${data.preco}`)
  }
}

console.log('\nPronto.')
process.exit(0)
