import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import { fileURLToPath } from 'url'

const AUTH_DIR = new URL('../auth', import.meta.url).pathname
const logger = pino({ level: 'silent' })

// onOpen(sock) é chamado toda vez que a conexão abre — inclusive após os
// restarts que o WhatsApp força logo depois do pareamento (statusCode 515),
// quando o `sock` antigo é descartado e um novo é criado internamente.
// Por isso quem precisa do socket ativo deve usar esse callback, nunca
// guardar a referência retornada por connect() direto.
export async function connect(onMessages, onOpen) {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
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
      if (shouldReconnect) connect(onMessages, onOpen)
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp.')
      onOpen?.(sock)
    }
  })

  if (onMessages) {
    sock.ev.on('messages.upsert', ({ messages }) => onMessages(sock, messages))
  }

  return sock
}
