import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url))
)

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

export async function upsertOferta(docId, data) {
  await db.collection('ofertas').doc(docId).set({
    ...data,
    quotedAt: Timestamp.fromDate(data.quotedAt),
    updatedAt: FieldValue.serverTimestamp(),
  })
}
