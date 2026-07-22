import { readFileSync } from 'fs'
import { proto } from '@whiskeysockets/baileys'
import { connect } from './src/connection.js'
import { mapMessageToOfertas } from './src/mapper.js'
import { upsertOferta, db } from './src/firestoreWriter.js'
import { syncGroupsWithFornecedores } from './src/matchFornecedores.js'
import { watchRecibosFila } from './src/reciboWatcher.js'
import { registrarStatus, notificarMac } from './src/botStatus.js'
import { checkAndSendAniversarios } from './src/aniversario.js'

// Uma promise rejeitada sem .catch() em qualquer lugar (inclusive dentro do
// Baileys) derruba o processo inteiro por padrão — já aconteceu 2x num único
// dia (motivo "1006", fechamento anormal do socket). Isso não passa pela
// reconexão em 1-2s de connection.js: o launchd mata e sobe o processo do
// zero, reautenticando — bem mais tempo fora do ar que uma queda normal.
// Melhor logar e seguir vivo do que derrubar o bot inteiro por causa disso.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection] Promise rejeitada sem catch — seguindo vivo:', reason)
})

const GROUPS_PATH = new URL('./config/groups.json', import.meta.url)
const SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1h — cobre "cadastrou fornecedor novo" sem precisar de deploy/restart
// Bem mais curto que o sync: é o "estou vivo" que o Dashboard usa pra acusar
// queda. O front considera o bot fora do ar se o sinal passar de 15min.
const HEARTBEAT_MS = 5 * 60 * 1000 // 5min
// Checagem de aniversário: sem cron externo, só um intervalo curto que
// dispara o envio real assim que a hora-alvo bate. Cobre o bot cair e voltar
// depois das 10h — pega no próximo tick em vez de esperar o dia seguinte.
const ANIVERSARIO_CHECK_MS = 10 * 60 * 1000 // 10min
const ANIVERSARIO_HORA = 10

let groups = JSON.parse(readFileSync(GROUPS_PATH))
function reloadGroups() {
  groups = JSON.parse(readFileSync(GROUPS_PATH))
}

async function syncAndReload(sock) {
  // O sync é uma varredura pesada (groupFetchAllParticipating + foto por
  // fornecedor). Rodá-lo com a conexão já capenga é jogar lenha numa fogueira:
  // o próprio sync vira a causa da próxima queda. Pula e tenta de novo no
  // próximo ciclo (1h) ou na próxima reconexão estável.
  if (quedasNaJanela() >= QUEDAS_PARA_INSTAVEL) {
    console.log('[sync] Pulado — conexão instável no momento.')
    return
  }
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
let aniversarioCheckStarted = false
let ultimoDiaAniversario = ''

// Estado real da conexão. O heartbeat antigo gravava `conectado: true` fixo, sem
// nunca olhar o socket: na madrugada de 21/07/26 o bot flapou a noite toda e o
// Dashboard ficou verde, então a queda só foi descoberta pelas listas que
// faltaram. O pulso agora reporta o que está acontecendo de fato.
let conectado = false
let motivoDesconexao = ''

// Janela móvel de quedas. Distingue "caiu e voltou" (normal, o backoff resolve)
// de "está flapando e perdendo listas" (precisa de gente).
const JANELA_QUEDAS_MS = 60 * 60 * 1000
const QUEDAS_PARA_INSTAVEL = 5
let quedas = []
let avisouInstavel = false

function quedasNaJanela() {
  const agora = Date.now()
  quedas = quedas.filter(t => agora - t < JANELA_QUEDAS_MS)
  return quedas.length
}

// Um pulso reflete o socket agora. Não gravamos `conectado: false` no próprio
// evento de queda de propósito: com o backoff, quedas de segundos são rotina e
// pintariam o Mural de vermelho à toa. Amostrar a cada 5min faz a queda curta
// passar batida e a queda real aparecer.
function pulsar() {
  const recentes = quedasNaJanela()
  const instavel = recentes >= QUEDAS_PARA_INSTAVEL
  registrarStatus({
    conectado,
    motivo: conectado ? '' : motivoDesconexao,
    quedasRecentes: recentes,
    instavel,
  })
  // Avisa uma vez por episódio: o alerta é sobre entrar em instabilidade, e
  // repetir a cada pulso enquanto dura viraria o ruído que faz ignorar alerta.
  if (instavel && !avisouInstavel) {
    avisouInstavel = true
    const msg = `${recentes} quedas na última hora. As listas podem estar entrando pela metade.`
    notificarMac('EIXO Bot instável', msg)
    console.error(`[status] ${msg}`)
  }
  if (!instavel) avisouInstavel = false
}

// onOpen dispara a cada (re)conexão — inclusive após restarts forçados pelo
// WhatsApp — então guardamos o sock mais recente e só armamos o setInterval
// e o listener da fila de recibos uma vez, pra não duplicar.
async function onOpen(sock) {
  currentSock = sock
  conectado = true
  motivoDesconexao = ''
  pulsar()
  if (!heartbeatStarted) {
    heartbeatStarted = true
    setInterval(pulsar, HEARTBEAT_MS)
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
  if (!aniversarioCheckStarted) {
    aniversarioCheckStarted = true
    setInterval(checarAniversarios, ANIVERSARIO_CHECK_MS)
    checarAniversarios() // cobre o boot já acontecendo depois das 10h
  }
}

// Dispara uma vez por dia, assim que a hora local bate ANIVERSARIO_HORA.
// Sem cron: um tick a cada 10min é suficiente e sobrevive a bot caindo e
// voltando depois do horário — não precisa estar de pé bem às 10h.
function checarAniversarios() {
  const agora = new Date()
  const hojeISO = agora.toISOString().slice(0, 10)
  if (ultimoDiaAniversario === hojeISO) return
  if (agora.getHours() < ANIVERSARIO_HORA) return
  ultimoDiaAniversario = hojeISO
  checkAndSendAniversarios(() => currentSock, db).catch(err => {
    console.error('[aniversario] erro ao checar/enviar:', err)
  })
}

// Toda queda conta pra janela de instabilidade. O logout (401) é o único caso
// que exige gente na hora — reparear pelo QR; as outras quedas o backoff
// resolve sozinho, e só viram alerta se passarem a se repetir.
function onClose({ statusCode, shouldReconnect }) {
  conectado = false
  quedas.push(Date.now())
  if (shouldReconnect) {
    motivoDesconexao = `Conexão caiu (código ${statusCode}); reconectando.`
    return
  }
  const motivo = `Sessão do WhatsApp desconectada (código ${statusCode}). Precisa parear de novo pelo QR code.`
  motivoDesconexao = motivo
  // Terminal: não espera o próximo pulso, ninguém vai reconectar sozinho.
  registrarStatus({ conectado: false, motivo, quedasRecentes: quedasNaJanela(), instavel: false })
  notificarMac('EIXO Bot fora do ar', motivo)
  console.error(`[status] ${motivo}`)
}

connect(handleMessages, onOpen, onClose)
