import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import { fileURLToPath } from 'url'

const AUTH_DIR = new URL('../auth', import.meta.url).pathname
const logger = pino({ level: 'silent' })

// O Baileys não reconecta sozinho: cada queda exige um socket novo. Feito sem
// controle isso vira loop — o socket morto continua emitindo 'close', cada
// 'close' chama connect() de novo e as conexões se multiplicam em vez de se
// substituírem (chegamos a 597 mil reconexões numa madrugada, com o bot vivo
// e sem ingerir nada). Três travas contra isso: guard de reentrada, backoff
// exponencial e descarte explícito dos listeners do socket morto.
let reconnecting = false
let attempt = 0
const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 5 * 60 * 1000

function nextDelayMs() {
  const base = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  attempt++
  // Jitter: sem ele, várias quedas em sequência voltam a bater no servidor
  // sempre no mesmo instante do ciclo.
  return Math.round(base * (0.5 + Math.random() * 0.5))
}

// onOpen(sock) é chamado toda vez que a conexão abre — inclusive após os
// restarts que o WhatsApp força logo depois do pareamento (statusCode 515),
// quando o `sock` antigo é descartado e um novo é criado internamente.
// Por isso quem precisa do socket ativo deve usar esse callback, nunca
// guardar a referência retornada por connect() direto.
// onClose({ statusCode, shouldReconnect }) dispara a cada queda — quem quiser
// reagir (registrar status, alertar) passa esse callback, mantendo o
// connection.js sem saber nada de Firestore.
export async function connect(onMessages, onOpen, onClose) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    // Sem isso o Baileys usa o default da lib (Browsers.ubuntu('Chrome')), que aparece
    // nas notificações do WhatsApp como "Google Chrome (Ubuntu)" — confuso, parece
    // dispositivo desconhecido/suspeito. Identifica como o bot que realmente é.
    browser: Browsers.appropriate('EIXO Bot'),
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      console.log('\nEscaneie este QR code em WhatsApp > Aparelhos conectados > Conectar aparelho:\n')
      qrcode.generate(qr, { small: true })
      const qrPngPath = fileURLToPath(new URL('../qr.png', import.meta.url))
      QRCode.toFile(qrPngPath, qr, { width: 400 }).catch(() => {})
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log('Conexão encerrada.', { statusCode, shouldReconnect })
      onClose?.({ statusCode, shouldReconnect })
      if (!shouldReconnect) return
      // Um socket anterior já agendou a volta — este 'close' é eco de um
      // socket que ficou pra trás, não um evento novo.
      if (reconnecting) return
      reconnecting = true
      // A partir daqui este socket está morto: sem isso ele segue emitindo
      // 'close' e cada eco vira uma reconexão paralela.
      sock.ev.removeAllListeners()
      const delay = nextDelayMs()
      console.log(`Reconectando em ${Math.round(delay / 1000)}s (tentativa ${attempt}).`)
      setTimeout(() => {
        reconnecting = false
        connect(onMessages, onOpen, onClose)
      }, delay)
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp.')
      // Conexão de pé: o próximo problema recomeça o backoff do início.
      attempt = 0
      onOpen?.(sock)
    }
  })

  if (onMessages) {
    sock.ev.on('messages.upsert', ({ messages }) => onMessages(sock, messages))
  }

  return sock
}
