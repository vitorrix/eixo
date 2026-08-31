// Captura o primeiro contato de um lead (cliente em potencial) que chega por
// DM no WhatsApp — tráfego pago (anúncio "Enviar mensagem" do Meta) ou
// mensagem direta. Roteado a partir de handleMessages() no index.js: só
// chega aqui quem NÃO é usuário conhecido do secretina (ver
// secretina/handler.js: ehUsuarioSecretina), pra não tratar Vitor/Ana como
// lead quando eles mandam DM pro próprio bot.
//
// TODO: fase 2 - Instagram DM. O Instagram Direct não passa pelo WhatsApp;
// precisa de outra integração (API do Meta) alimentando essa mesma coleção
// com source: 'instagram_direto' — os pontos que mudam estão marcados abaixo.
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestoreWriter.js'

// Mesmo parsing usado no secretina (secretina/handler.js) — jid de DM vem
// como "5511995844837@s.whatsapp.net" — ou, nesta conta, às vezes como
// "...@lid" (identificador opaco de dispositivo do WhatsApp; extrair dígitos
// dele gera um "telefone" grande e sem sentido, não o número de verdade).
// Baileys 6.7+ expõe o número real nesse caso em msg.key.senderPn ("sender
// phone number") — parte do rollout de LID do próprio WhatsApp. Preferir
// sempre que disponível; leads antigos capturados com o @lid cru (antes
// dessa correção) ficam órfãos com o "telefone" errado — não há como migrar
// esse doc de volta, mas contatos novos já entram certos.
function jidTelefonico(jid, msg) {
  if (jid.endsWith('@lid') && msg.key?.senderPn) return msg.key.senderPn
  return jid
}

function telefoneFromJid(jid) {
  return jid.split('@')[0].split(':')[0]
}

// "Anúncio do Instagram" clicado pelo lead ("Enviar mensagem") chega como um
// card de contexto anexado à primeira mensagem — não é texto digitado pelo
// lead, é metadado do próprio WhatsApp.
function extrairAdContext(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo?.externalAdReply
  if (!ctx) return null
  return [ctx.title, ctx.body].filter(Boolean).join(' — ') || null
}

// Primeiro contato pode não ser texto puro (foto do aparelho, áudio, figurinha)
// — sem isso, o lead simplesmente não era capturado (texto vazio nunca chega
// no index.js). Só um resumo legível, não precisa do conteúdo de verdade.
export function descreverMidia(message) {
  if (!message) return null
  if (message.imageMessage) return message.imageMessage.caption ? `[Imagem] ${message.imageMessage.caption}` : '[Imagem sem legenda]'
  if (message.videoMessage) return message.videoMessage.caption ? `[Vídeo] ${message.videoMessage.caption}` : '[Vídeo sem legenda]'
  if (message.audioMessage) return message.audioMessage.ptt ? '[Áudio / mensagem de voz]' : '[Áudio]'
  if (message.stickerMessage) return '[Figurinha]'
  if (message.documentMessage) return `[Documento] ${message.documentMessage.fileName || 'sem nome'}`
  return null
}

// Só grava na primeira mensagem: se o lead já existe, não mexe (evita
// resetar status/notas/follow-up de um lead que já está sendo trabalhado
// só porque ele mandou outra mensagem).
export async function capturarLead(jid, msg, text) {
  const phone = telefoneFromJid(jidTelefonico(jid, msg))
  if (!phone) return

  const ref = db.collection('leads').doc(phone)
  const snap = await ref.get()
  if (snap.exists) return

  const adContext = extrairAdContext(msg)

  await ref.set({
    phone,
    name: msg.pushName || null,
    source: adContext ? 'whatsapp_anuncio' : 'whatsapp_direto', // TODO: fase 2 - 'instagram_direto'
    adContext,
    firstMessageText: text,
    firstMessageAt: FieldValue.serverTimestamp(),
    status: 'novo',
    discardReason: null,
    discardNote: null,
    nextFollowUpAt: null,
    notes: [],
    assignedTo: null,
    clienteId: null,
    // Chamada perdida (áudio/vídeo) é o sinal de intenção de compra mais
    // forte que existe — hoje só é marcado à mão pela equipe no quadro
    // (marcarChamadaPerdida em src/modules/leads/service.js).
    // TODO: sinalizar quando a fonte de dados incluir chamadas perdidas.
    // O Baileys emite evento de chamada via sock.ev.on('call', ...) (array
    // de CallEvent, com status 'offer'/'timeout'/'reject' e isVideo) —
    // dá pra detectar chamada perdida ouvindo status 'timeout' (ninguém
    // atendeu) sem vir de nós (!call.fromMe) e chamar marcarChamadaPerdida
    // direto no Firestore (não passa por capturarLead, que só roda na
    // primeira mensagem: teria que atualizar um lead já existente também).
    missedCallAt: null,
    missedCallTipo: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}
