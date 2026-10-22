import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url))
)

initializeApp({ credential: cert(serviceAccount) })
export const db = getFirestore()

export async function upsertOferta(docId, data) {
  await db.collection('ofertas').doc(docId).set({
    ...data,
    quotedAt: Timestamp.fromDate(data.quotedAt),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

const slug = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Fila de revisão de cores: 1 documento por (modelo oficial + texto da cor).
// O Eixo lista os pendentes; a decisão (cor oficial ou ignorar) é aplicada de volta
// nas ofertas pelo bot. create() só cria se ainda não existe — nunca reabre um item
// já decidido; as contagens sobem sempre.
export async function registrarCorRevisao({ modelo, textoCor, fornecedor, exemplo }, ocorrencias = 1) {
  if (!modelo || !textoCor) return
  const ref = db.collection('coresRevisao').doc(`${slug(modelo)}__${slug(textoCor)}`)
  try {
    await ref.create({
      modelo, textoCor, status: 'pendente', ocorrencias: 0, fornecedores: [],
      exemplo: exemplo || '', criadoEm: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    if (err.code !== 6 && !/already exists/i.test(err.message || '')) throw err
  }
  await ref.update({
    ocorrencias: FieldValue.increment(ocorrencias),
    fornecedores: FieldValue.arrayUnion(...(fornecedor ? [fornecedor] : [])),
    exemplo: exemplo || '',
    atualizadoEm: FieldValue.serverTimestamp(),
  })
}
