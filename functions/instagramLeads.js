// Lado do Instagram do módulo Leads (fase 2) — espelha
// whatsapp-bot/src/leads.js, mas rodando como Cloud Function em vez de
// bot local: o Instagram entrega mensagem via webhook HTTPS (a Meta chama a
// gente), não tem como "escutar" como o WhatsApp/Baileys faz.
import crypto from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'

// Toda chamada de webhook da Meta vem assinada com o App Secret — sem
// conferir isso, qualquer um que descobrisse a URL da function podia forjar
// leads fake direto no Firestore.
export function assinaturaValida(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret || !rawBody) return false
  const esperado = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

const TIPO_ANEXO = {
  image: 'Imagem', video: 'Vídeo', audio: 'Áudio',
  story_mention: 'Menção no Story', share: 'Compartilhamento',
}

function descreverAnexos(attachments) {
  if (!attachments?.length) return null
  return `[${TIPO_ANEXO[attachments[0].type] || 'Anexo'}]`
}

// Formato documentado pela Meta (Instagram Messaging webhooks):
// { object:'instagram', entry:[{ id, time, messaging:[{ sender:{id},
//   recipient:{id}, timestamp, message:{mid,text,attachments,is_echo},
//   referral? }] }] }
// "referral" (clique em anúncio "Enviar mensagem") ainda não foi visto com
// tráfego real — a Meta documenta em mais de um lugar possível (solto no
// item de messaging ou dentro de message), tratamos os dois. Ajustar aqui
// se o formato real vier diferente quando o primeiro anúncio rodar.
export function extrairEventosMensagem(body) {
  if (body?.object !== 'instagram') return []
  const eventos = []
  for (const entry of body.entry || []) {
    for (const m of entry.messaging || []) {
      if (!m.message || m.message.is_echo) continue // is_echo: nós mandamos, não é o lead falando
      const igsid = m.sender?.id
      if (!igsid) continue
      const referral = m.referral || m.message.referral || null
      const adContext = referral
        ? [referral.ref, referral.source, referral.ad_id].filter(Boolean).join(' · ') || null
        : null
      const text = m.message.text || descreverAnexos(m.message.attachments)
      if (!text) continue
      eventos.push({ igsid, text, adContext })
    }
  }
  return eventos
}

// Só grava na primeira mensagem — igual ao WhatsApp: se o lead já existe,
// não mexe, pra não resetar status/notas/follow-up de quem já está em
// atendimento só porque mandou outra mensagem.
export async function capturarLeadInstagram(db, { igsid, text, adContext }) {
  const ref = db.collection('leads').doc(`ig_${igsid}`)
  const snap = await ref.get()
  if (snap.exists) return

  await ref.set({
    phone: null,
    igsid,
    // TODO: buscar nome de verdade via Graph API
    // GET /{igsid}?fields=name,username&access_token=... — precisa de um
    // token de acesso da Página com permissão instagram_manage_messages.
    // Sem isso, nomeExibicao() no front cai pro telefone formatado, que
    // pra lead do Instagram é null — mostra "—" até essa busca existir.
    name: null,
    source: adContext ? 'instagram_anuncio' : 'instagram_direto',
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
