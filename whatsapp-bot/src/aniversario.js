// Mensagem de aniversário automática — mesmo padrão do recibo
// (reciboWatcher.js): gera um arquivo em memória e manda pelo socket do
// bot. A diferença é o gatilho: recibo nasce de clique no front (por isso
// passa por uma fila no Firestore); aniversário nasce só de bater a data,
// então o próprio bot decide sozinho, sem fila.
import { fileURLToPath } from 'url'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

const ASSETS_DIR = fileURLToPath(new URL('../assets/aniversario/', import.meta.url))
const FONT_PATH  = ASSETS_DIR + 'nome-font.ttf'
const FUNDOS = [
  { arquivo: ASSETS_DIR + 'fundo-cinza.png',   corTexto: '#1a1a1a' },
  { arquivo: ASSETS_DIR + 'fundo-laranja.png', corTexto: '#ffffff' },
]

const FONT_FAMILY = 'AniversarioNome'
let fontRegistrada = false
function garantirFonte() {
  if (fontRegistrada) return
  GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY)
  fontRegistrada = true
}

// Posição/tamanho do nome como fração da arte — ajustar aqui depois de ver
// os PNGs reais exportados do Canva (a área em branco deixada no lugar do
// nome removido).
const NOME_Y_FRACAO      = 0.52
const NOME_MAX_W_FRACAO  = 0.8
const NOME_FONTE_MAX_PX  = 90
const NOME_FONTE_MIN_PX  = 36

async function gerarArte(nome, fundo) {
  garantirFonte()
  const img = await loadImage(fundo.arquivo)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const maxWidth = img.width * NOME_MAX_W_FRACAO
  let fontSize = NOME_FONTE_MAX_PX
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  do {
    ctx.font = `${fontSize}px "${FONT_FAMILY}"`
    if (ctx.measureText(nome).width <= maxWidth || fontSize <= NOME_FONTE_MIN_PX) break
    fontSize -= 2
  } while (true)

  ctx.fillStyle = fundo.corTexto
  ctx.fillText(nome, img.width / 2, img.height * NOME_Y_FRACAO)

  return canvas.encode('png')
}

const primeiroNome = nomeCompleto => (nomeCompleto || '').trim().split(/\s+/)[0] || ''
const rawDigits = v => (v || '').replace(/\D/g, '')
const hojeISO = () => new Date().toISOString().slice(0, 10)
const hojeMD = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

// jid já pronto (ex: "5511999999999@s.whatsapp.net") — usado tanto pelo
// checkAndSendAniversarios quanto pelo script de teste manual.
export async function enviarAniversario(sock, { nome, jid }) {
  const nome1 = primeiroNome(nome)
  const fundo = FUNDOS[Math.floor(Math.random() * FUNDOS.length)]
  const buffer = await gerarArte(nome || nome1, fundo)
  await sock.sendMessage(jid, {
    image: buffer,
    caption: `Feliz aniversário, ${nome1}! 🎉 Um abraço da equipe Baruk Technology.`,
  })
}

export async function checkAndSendAniversarios(getSock, db) {
  const sock = getSock()
  if (!sock) {
    console.error('[aniversario] sem conexão ativa com o WhatsApp — tenta de novo no próximo ciclo.')
    return
  }

  const hoje = hojeMD()
  const snap = await db.collection('clientes').where('birthdayMD', '==', hoje).get()
  if (snap.empty) return

  for (const doc of snap.docs) {
    const c = doc.data()
    try {
      const digits = rawDigits(c.phone)
      if (!digits) {
        console.log(`[aniversario] ${c.name || doc.id} sem telefone cadastrado — pulado.`)
        continue
      }
      if (c.ultimoAniversarioEnviado === hojeISO()) continue // já mandado hoje

      const jid = `${c.phoneCountry || '55'}${digits}@s.whatsapp.net`
      await enviarAniversario(sock, { nome: c.name, jid })
      await doc.ref.update({ ultimoAniversarioEnviado: hojeISO() })
      console.log(`[aniversario] enviado para ${c.name} (${digits}).`)
    } catch (err) {
      console.error(`[aniversario] falha ao enviar para ${c.name || doc.id}:`, err)
    }
  }
}
