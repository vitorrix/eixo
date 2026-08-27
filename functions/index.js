import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assinaturaValida, extrairEventosMensagem, capturarLeadInstagram } from './instagramLeads.js'

initializeApp()
const db = getFirestore()

// Configurados via `firebase functions:secrets:set` — nunca em texto puro no
// código/repositório. VERIFY_TOKEN é uma string qualquer que a gente escolhe
// (cadastrada igual nos dois lados, aqui e no painel da Meta); APP_SECRET é o
// segredo do App da Meta, usado só pra conferir a assinatura de cada POST.
const VERIFY_TOKEN = defineSecret('INSTAGRAM_VERIFY_TOKEN')
const APP_SECRET = defineSecret('INSTAGRAM_APP_SECRET')
// Token da conta barukloja (gerado manualmente no painel da Meta, "Gerar
// tokens de acesso") — usado só pra buscar o nome/username de quem manda DM,
// via Graph API. Se vencer/for revogado, a captura do lead continua
// funcionando normal, só o nome volta a ficar em branco.
const ACCESS_TOKEN = defineSecret('INSTAGRAM_ACCESS_TOKEN')

// Endpoint único pros dois passos do webhook do Instagram:
// - GET: handshake de verificação, a Meta chama uma vez ao cadastrar a URL.
// - POST: evento de mensagem de verdade, chamado toda vez que um lead manda DM.
export const instagramWebhook = onRequest(
  { secrets: [VERIFY_TOKEN, APP_SECRET, ACCESS_TOKEN], region: 'southamerica-east1', cors: false },
  async (req, res) => {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode']
      const token = req.query['hub.verify_token']
      const challenge = req.query['hub.challenge']
      if (mode === 'subscribe' && token === VERIFY_TOKEN.value()) {
        res.status(200).send(challenge)
      } else {
        console.error('[instagram-webhook] verificação falhou — token não bate')
        res.sendStatus(403)
      }
      return
    }

    if (req.method === 'POST') {
      // req.rawBody: só existe em onRequest do firebase-functions (guarda o
      // corpo cru antes do parse) — a assinatura da Meta é sobre os bytes
      // originais, não sobre o JSON já reserializado.
      const assinatura = req.get('x-hub-signature-256')
      if (!assinaturaValida(req.rawBody, assinatura, APP_SECRET.value())) {
        console.error('[instagram-webhook] assinatura inválida — possível chamada forjada')
        res.sendStatus(401)
        return
      }

      try {
        const eventos = extrairEventosMensagem(req.body)
        for (const evento of eventos) {
          await capturarLeadInstagram(db, { ...evento, accessToken: ACCESS_TOKEN.value() })
        }
      } catch (err) {
        console.error('[instagram-webhook] erro ao processar evento:', err)
        // Mesmo com erro, responde 200 — a Meta reenvia (várias vezes, com
        // backoff) qualquer evento que não receba 200, e um erro de
        // parsing num evento não deve virar um loop de reentrega infinito.
      }
      res.sendStatus(200)
      return
    }

    res.sendStatus(405)
  }
)
