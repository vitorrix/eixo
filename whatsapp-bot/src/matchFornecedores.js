// Sincroniza config/groups.json com os fornecedores cadastrados no Eixo que
// têm comunidade: true — casando pelo telefone do fornecedor com o admin/dono
// de cada canal de avisos (isCommunityAnnounce) real do WhatsApp. Rode de novo
// sempre que marcar um novo fornecedor com comunidade + telefone no Eixo.
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'
import { connect } from './connection.js'

const sa = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)))
initializeApp({ credential: cert(sa) })
const db = getFirestore()

const GROUPS_PATH = new URL('../config/groups.json', import.meta.url)

const VALIDADE_DIAS = 90
function isValidado(lastValidatedAt) {
  if (!lastValidatedAt) return false
  const dueDate = lastValidatedAt.toDate()
  dueDate.setDate(dueDate.getDate() + VALIDADE_DIAS)
  return dueDate > new Date()
}

function normPhone(country, phone) {
  return `${(country || '55').replace(/\D/g, '')}${(phone || '').replace(/\D/g, '')}`
}

await connect(null, async (sock) => {
  const snap = await db.collection('fornecedores').where('comunidade', '==', true).get()
  const fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  const groups = await sock.groupFetchAllParticipating()
  const announceGroups = Object.values(groups).filter(g => g.isCommunityAnnounce)

  const groupsJson = JSON.parse(readFileSync(GROUPS_PATH))
  let atualizados = 0

  console.log(`\n${fornecedores.length} fornecedor(es) com comunidade=true. ${announceGroups.length} canal(is) de avisos encontrados.\n`)

  for (const f of fornecedores) {
    const alvo = normPhone(f.phoneCountry, f.phone)
    const grupo = announceGroups.find(g =>
      g.participants.some(p => (p.jid || '').split('@')[0] === alvo)
    )

    if (!grupo) {
      console.log(`❌ ${f.name}  (tel ${alvo})  — não encontrado em nenhum canal de avisos`)
      continue
    }

    let fotoUrl = ''
    try {
      fotoUrl = await sock.profilePictureUrl(`${alvo}@s.whatsapp.net`, 'image')
    } catch {
      // fornecedor sem foto de perfil pública — fica sem avatar (fallback no front)
    }

    groupsJson[grupo.id] = {
      fornecedorId: f.id,
      fornecedorNome: f.name,
      phone: (f.phone || '').replace(/\D/g, ''),
      phoneCountry: f.phoneCountry || '55',
      categorias: f.categorias || [],
      verified: isValidado(f.lastValidatedAt),
      box: f.box || '',
      fotoUrl,
    }
    atualizados++
    console.log(`✅ ${f.name}  →  ${grupo.id}  (${grupo.subject})${fotoUrl ? ' [com foto]' : ''}`)
  }

  writeFileSync(GROUPS_PATH, JSON.stringify(groupsJson, null, 2) + '\n')
  console.log(`\n${atualizados} entrada(s) gravada(s) em config/groups.json.`)
  process.exit(0)
})
