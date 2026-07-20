// Sinal de vida do bot, gravado em configuracoes/botStatus e lido pelo Eixo
// (Mural do Dashboard). É heartbeat, não alerta: em vez de tentar avisar na
// hora que cai — o que não funciona justamente nos piores casos, já que um
// logout mata o WhatsApp e um crash mata o processo inteiro —, o bot marca
// que está vivo de tempos em tempos e o front acusa quando esse sinal
// envelhece. Assim qualquer falha aparece, inclusive queda de energia.
import { execFile } from 'child_process'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firestoreWriter.js'

const STATUS_REF = () => db.collection('configuracoes').doc('botStatus')

export async function registrarStatus({ conectado, motivo = '' }) {
  try {
    await STATUS_REF().set({
      conectado,
      motivo,
      atualizadoEm: FieldValue.serverTimestamp(),
    }, { merge: true })
  } catch (err) {
    // Sem rede o heartbeat falha — não pode derrubar o bot. O próprio silêncio
    // (documento envelhecendo) já é o sinal que o Dashboard usa.
    console.error('[status] Falha ao gravar status do bot:', err.message)
  }
}

// Notificação nativa do macOS — o bot roda na máquina do Vitor via launchd,
// então isso aparece na hora. execFile (não exec) evita passar a mensagem pelo
// shell, sem risco de interpretação de aspas/caracteres especiais.
export function notificarMac(titulo, mensagem) {
  const script = `display notification ${JSON.stringify(mensagem)} with title ${JSON.stringify(titulo)} sound name "Basso"`
  execFile('osascript', ['-e', script], err => {
    if (err) console.error('[status] Falha ao notificar no macOS:', err.message)
  })
}
