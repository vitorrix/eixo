// Mensagem de aniversário automática — mesmo padrão do recibo
// (reciboWatcher.js): gera um arquivo em memória e manda pelo socket do
// bot. A diferença é o gatilho: recibo nasce de clique no front (por isso
// passa por uma fila no Firestore); aniversário nasce só de bater a data,
// então o próprio bot decide sozinho, sem fila.
import { fileURLToPath } from 'url'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

const ASSETS_DIR = fileURLToPath(new URL('../assets/aniversario/', import.meta.url))
const FONT_PATH  = ASSETS_DIR + 'nome-font.ttf'
const FUNDO = { arquivo: ASSETS_DIR + 'fundo.png', corTexto: '#ffffff' }

const FONT_FAMILY = 'AniversarioNome'
let fontRegistrada = false
function garantirFonte() {
  if (fontRegistrada) return
  GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY)
  fontRegistrada = true
}

// Posição/tamanho do nome como fração da arte (fundo.png, 941×1672) — o
// espaço vazio deixado entre "ANIVERSÁRIO" (~47% da altura) e a linha fina
// acima do parágrafo (~68%). Tamanho de fonte em fração da largura pra
// escalar certo se o arquivo de fundo for trocado por um de outra resolução.
const NOME_Y_FRACAO         = 0.58
const NOME_MAX_W_FRACAO     = 0.85
const NOME_FONTE_MAX_FRACAO = 0.17
const NOME_FONTE_MIN_FRACAO = 0.08

async function gerarArte(nome) {
  garantirFonte()
  const img = await loadImage(FUNDO.arquivo)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const maxWidth = img.width * NOME_MAX_W_FRACAO
  const fontMaxPx = img.width * NOME_FONTE_MAX_FRACAO
  const fontMinPx = img.width * NOME_FONTE_MIN_FRACAO
  let fontSize = fontMaxPx
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  do {
    ctx.font = `${fontSize}px "${FONT_FAMILY}"`
    if (ctx.measureText(nome).width <= maxWidth || fontSize <= fontMinPx) break
    fontSize -= 2
  } while (true)

  ctx.fillStyle = FUNDO.corTexto
  ctx.fillText(nome, img.width / 2, img.height * NOME_Y_FRACAO)

  return canvas.encode('png')
}

// Primeiro nome + primeiro sobrenome de verdade — pula iniciais soltas (ex:
// "B", "C") e preposições (de/da/do/dos/das), pega o primeiro nome de família
// que sobra. Ex: "Miriam B C dos Santos" → "Miriam Santos"; "Diogo Marinho de
// Melo" → "Diogo Marinho" (não "Diogo Melo" — o sobrenome mais usado costuma
// vir logo depois do primeiro nome, não no fim). Nome completo de família não
// cabe bem na arte nem soa natural na mensagem.
const PREPOSICOES_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const nomeCurto = nomeCompleto => {
  const partes = (nomeCompleto || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 1) return partes[0] || ''
  const sobrenome = partes.slice(1).find(p => p.length > 1 && !PREPOSICOES_NOME.has(p.toLowerCase()))
  return sobrenome ? `${partes[0]} ${sobrenome}` : partes[0]
}

const mensagemAniversario = nome => `Parabéns, ${nome}! 🎉

Hoje é o seu dia, e é com muita alegria que viemos desejar um feliz aniversário cheio de realizações e momentos especiais! 🥳🎂

Esperamos que esse novo ciclo seja marcado por muito sucesso, saúde e felicidade.

Com carinho,
Equipe Baruk`

const rawDigits = v => (v || '').replace(/\D/g, '')
// Data local, não UTC — toISOString() já vira o dia seguinte a partir das 21h
// no horário de Brasília, o que faria o dedup de "já mandei hoje" falhar.
const hojeISO = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}
const hojeMD = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

// jid já pronto (ex: "5511999999999@s.whatsapp.net") — usado tanto pelo
// checkAndSendAniversarios quanto pelo script de teste manual.
export async function enviarAniversario(sock, { nome, jid }) {
  const exibicao = nomeCurto(nome)
  const buffer = await gerarArte(exibicao)
  await sock.sendMessage(jid, {
    image: buffer,
    caption: mensagemAniversario(exibicao),
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
