import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

const AUTH_DIR = new URL('../auth', import.meta.url).pathname
const logger = pino({ level: 'silent' })

export async function connect(onMessages) {
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
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : null
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut
      console.log('Conexão encerrada.', { statusCode, shouldReconnect })
      if (shouldReconnect) connect(onMessages)
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp.')
    }
  })

  if (onMessages) {
    sock.ev.on('messages.upsert', ({ messages }) => onMessages(sock, messages))
  }

  return sock
}
