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
// como "5511995844837@s.whatsapp.net" (às vezes "...@lid" nesta conta, um
// identificador opaco do WhatsApp que não é o número de telefone de verdade;
// limitação conhecida, não resolvida aqui nem no secretina).
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

// Só grava na primeira mensagem: se o lead já existe, não mexe (evita
// resetar status/notas/follow-up de um lead que já está sendo trabalhado
// só porque ele mandou outra mensagem).
export async function capturarLead(jid, msg, text) {
  const phone = telefoneFromJid(jid)
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
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}
