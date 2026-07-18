// Migração pontual: separa "condição" (novo/semi-novo/misto) de "marca" no
// cadastro de fornecedores. Antes, "seminovo" era uma das categorias de marca;
// agora condição é campo próprio (fornecedor.condicao) e categorias fica só com
// marca (apple/android/acessorios).
//
// Regra de derivação a partir das categorias atuais:
//   - tem 'seminovo' + alguma marca  → 'misto'    (vende novo E semi-novo)
//   - só ['seminovo'] (sem marca)     → 'seminovo' (fornecedor de semi-novo puro)
//   - sem 'seminovo'                  → 'novo'
// Em todos os casos, 'seminovo' é removido de categorias.
//
// Por padrão roda em dry-run. Pra aplicar: node scripts/migrate-fornecedor-condicao.js --apply
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(
  readFileSync(new URL('../whatsapp-bot/serviceAccountKey.json', import.meta.url))
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const APPLY = process.argv.includes('--apply')
const MARCAS = new Set(['apple', 'android', 'acessorios'])

function derivar(categorias) {
  const cats = Array.isArray(categorias) ? categorias : []
  const temSeminovo = cats.includes('seminovo')
  const marcas = cats.filter(c => MARCAS.has(c))
  let condicao
  if (!temSeminovo) condicao = 'novo'
  else if (marcas.length) condicao = 'misto'
  else condicao = 'seminovo'
  return { condicao, categorias: marcas }
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  const snap = await db.collection('fornecedores').get()
  console.log(`${snap.size} fornecedor(es) encontrados.\n`)

  let mudam = 0
  const batchDocs = []
  for (const doc of snap.docs) {
    const f = doc.data()
    // já migrado (tem condicao e categorias sem seminovo) → pula
    const jaMigrado = f.condicao && !(f.categorias || []).includes('seminovo')
    const { condicao, categorias } = derivar(f.categorias)
    if (jaMigrado && f.condicao === condicao) continue

    mudam++
    const catAntes = (f.categorias || []).join('+') || '(vazio)'
    const catDepois = categorias.join('+') || '(vazio)'
    console.log(`  ${f.name}`)
    console.log(`     categorias: ${catAntes}  →  ${catDepois}`)
    console.log(`     condição:   ${f.condicao || '(nenhuma)'}  →  ${condicao}`)
    batchDocs.push({ ref: doc.ref, condicao, categorias })
  }

  console.log(`\n${mudam} fornecedor(es) seriam atualizados.`)

  if (!APPLY) {
    console.log('\nDry-run — nada foi gravado. Rode com --apply para aplicar de verdade.')
    process.exit(0)
  }

  for (let i = 0; i < batchDocs.length; i += 400) {
    const chunk = batchDocs.slice(i, i + 400)
    const batch = db.batch()
    chunk.forEach(({ ref, condicao, categorias }) => batch.update(ref, { condicao, categorias }))
    await batch.commit()
  }
  console.log(`\n${batchDocs.length} fornecedor(es) atualizados. Pronto.`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
