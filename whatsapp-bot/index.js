import { readFileSync } from 'fs'
import { proto } from '@whiskeysockets/baileys'
import { connect } from './src/connection.js'
import { mapMessageToOfertas } from './src/mapper.js'
import { upsertOferta, db } from './src/firestoreWriter.js'
import { syncGroupsWithFornecedores } from './src/matchFornecedores.js'
import { watchRecibosFila } from './src/reciboWatcher.js'
import { registrarStatus, notificarMac } from './src/botStatus.js'

const GROUPS_PATH = new URL('./config/groups.json', import.meta.url)
const SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1h — cobre "cadastrou fornecedor novo" sem precisar de deploy/restart
// Bem mais curto que o sync: é o "estou vivo" que o Dashboard usa pra acusar
// queda. O front considera o bot fora do ar se o sinal passar de 15min.
const HEARTBEAT_MS = 5 * 60 * 1000 // 5min

let groups = JSON.parse(readFileSync(GROUPS_PATH))
function reloadGroups() {
  groups = JSON.parse(readFileSync(GROUPS_PATH))
}

async function syncAndReload(sock) {
  try {
    const atualizados = await syncGroupsWithFornecedores(sock, db)
    if (atualizados > 0) reloadGroups()
  } catch (err) {
    console.error('Erro ao sincronizar fornecedores com grupos do WhatsApp:', err)
  }
}

async function handleMessages(sock, messages) {
  for (const msg of messages) {
    const jid = msg.key.remoteJid
    const groupMeta = groups[jid]

    if (!msg.message) {
      // Falha de decriptação (ex: Bad MAC) — o Baileys já tenta reenvio automático
      // com o remetente; isso só loga o caso de perda definitiva pra rastrear no bot.error.log.
      if (groupMeta && msg.messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT) {
        console.error(`[decrypt-fail] Mensagem descartada (falha de decriptação) do grupo ${groupMeta.fornecedorNome} (${jid}), id ${msg.key.id}`)
      }
      continue
    }

    if (!groupMeta) continue // ignora grupos não mapeados em config/groups.json

    const text = msg.message.conversation
      || msg.message.extendedTextMessage?.text
      || ''
    if (!text) continue

    const quotedAt = new Date((Number(msg.messageTimestamp) || Date.now() / 1000) * 1000)
    let ofertas
    try {
      ofertas = await mapMessageToOfertas(text, quotedAt, groupMeta)
    } catch (err) {
      console.error(`Erro ao interpretar mensagem via IA (grupo ${groupMeta.fornecedorNome}, ${jid}):`, err)
      continue
    }

    for (const { docId, data } of ofertas) {
      try {
        await upsertOferta(docId, data)
        console.log(`[ingest] ${data.produtoNome} ${data.variante} — R$ ${data.preco} (${data.fornecedorNome})`)
      } catch (err) {
        console.error('Erro ao gravar oferta:', err)
      }
    }
  }
}

let currentSock = null
let intervalStarted = false
let filaWatcherStarted = false
let heartbeatStarted = false
let syncedOnce = false

// onOpen dispara a cada (re)conexão — inclusive após restarts forçados pelo
// WhatsApp — então guardamos o sock mais recente e só armamos o setInterval
// e o listener da fila de recibos uma vez, pra não duplicar.
async function onOpen(sock) {
  currentSock = sock
  registrarStatus({ conectado: true })
  if (!heartbeatStarted) {
    heartbeatStarted = true
    setInterval(() => registrarStatus({ conectado: true }), HEARTBEAT_MS)
  }
  // Só no primeiro open. O sync é caro (groupFetchAllParticipating + uma
  // profilePictureUrl por fornecedor) e rodá-lo a cada reconexão inunda o
  // WhatsApp de queries, que responde com timeout e derruba a conexão de
  // novo — o sync vira causa da queda seguinte. Nas reconexões o groups.json
  // já está em memória, e o setInterval abaixo cobre fornecedor novo.
  if (!syncedOnce) {
    syncedOnce = true
    await syncAndReload(sock)
  }
  if (!intervalStarted) {
    intervalStarted = true
    setInterval(() => {
      if (currentSock) syncAndReload(currentSock)
    }, SYNC_INTERVAL_MS)
  }
  if (!filaWatcherStarted) {
    filaWatcherStarted = true
    watchRecibosFila(() => currentSock, db)
  }
}

// Só o logout (401) exige ação humana — reparear pelo QR. As outras quedas o
// Baileys reconecta sozinho, então não viram alerta pra não virar ruído.
function onClose({ statusCode, shouldReconnect }) {
  if (shouldReconnect) return
  const motivo = `Sessão do WhatsApp desconectada (código ${statusCode}). Precisa parear de novo pelo QR code.`
  registrarStatus({ conectado: false, motivo })
  notificarMac('EIXO Bot fora do ar', motivo)
  console.error(`[status] ${motivo}`)
}

connect(handleMessages, onOpen, onClose)
