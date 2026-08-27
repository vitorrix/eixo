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

// GET /{igsid}?fields=name,username — só funciona no host graph.instagram.com
// (confirmado testando de verdade; graph.facebook.com dá "Invalid OAuth
// access token" pra esse tipo de token, gerado pelo fluxo "API do Instagram
// com login do Instagram", diferente do fluxo antigo via Página do Facebook).
// Falha aqui não pode derrubar a captura do lead — sem token configurado ou
// qualquer erro da API, cai pro nome null (front mostra o telefone/—).
async function buscarNomeInstagram(igsid, accessToken) {
  if (!accessToken) return null
  try {
    const url = `https://graph.instagram.com/v21.0/${igsid}?fields=name,username&access_token=${accessToken}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[instagram-webhook] Graph API respondeu', res.status, 'ao buscar nome do lead', igsid)
      return null
    }
    const data = await res.json()
    return data.name || data.username || null
  } catch (err) {
    console.error('[instagram-webhook] erro ao buscar nome do lead:', err)
    return null
  }
}

// Só grava na primeira mensagem — igual ao WhatsApp: se o lead já existe,
// não mexe, pra não resetar status/notas/follow-up de quem já está em
// atendimento só porque mandou outra mensagem.
export async function capturarLeadInstagram(db, { igsid, text, adContext, accessToken }) {
  const ref = db.collection('leads').doc(`ig_${igsid}`)
  const snap = await ref.get()
  if (snap.exists) return

  const name = await buscarNomeInstagram(igsid, accessToken)

  await ref.set({
    phone: null,
    igsid,
    name,
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
    // Chamada de áudio/vídeo perdida é o sinal de intenção de compra mais
    // forte que existe — hoje só é marcado à mão pela equipe no quadro
    // (marcarChamadaPerdida em src/modules/leads/service.js). Espelha o
    // mesmo TODO de whatsapp-bot/src/leads.js.
    // TODO: sinalizar quando a fonte de dados incluir chamadas perdidas.
    // A Meta documenta eventos de chamada do Instagram Messaging separados
    // do evento de mensagem (webhook field diferente de "messages"; ainda
    // não confirmado com tráfego real) — quando existir, extrairEventosMensagem
    // precisaria reconhecer esse tipo de evento e, diferente de mensagem de
    // texto, uma chamada perdida deveria ATUALIZAR um lead já existente
    // também (não só criar), então não pode usar o mesmo early-return
    // "if (snap.exists) return" daqui — provavelmente uma função própria,
    // tipo marcarChamadaPerdidaInstagram(db, igsid, tipo).
    missedCallAt: null,
    missedCallTipo: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}
