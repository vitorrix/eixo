// Sincroniza config/groups.json com os fornecedores cadastrados no Eixo que
// têm comunidade: true — casando pelo telefone do fornecedor com o admin/dono
// de cada canal de avisos (isCommunityAnnounce) real do WhatsApp.
// syncGroupsWithFornecedores() é chamada automaticamente pelo bot (index.js)
// usando o socket já conectado; rodar este arquivo direto (npm run
// match-fornecedores) continua funcionando como checagem manual avulsa.
import { readFileSync, writeFileSync } from 'fs'

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

export async function syncGroupsWithFornecedores(sock, db, { log = console.log } = {}) {
  const snap = await db.collection('fornecedores').where('comunidade', '==', true).get()
  const fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }))

  const groups = await sock.groupFetchAllParticipating()
  const announceGroups = Object.values(groups).filter(g => g.isCommunityAnnounce)

  const groupsJson = JSON.parse(readFileSync(GROUPS_PATH))
  let atualizados = 0

  log(`[match-fornecedores] ${fornecedores.length} fornecedor(es) com comunidade=true. ${announceGroups.length} canal(is) de avisos encontrados.`)

  for (const f of fornecedores) {
    const alvo = normPhone(f.phoneCountry, f.phone)
    const grupo = announceGroups.find(g =>
      g.participants.some(p => (p.jid || '').split('@')[0] === alvo)
    )

    if (!grupo) {
      log(`[match-fornecedores] ❌ ${f.name}  (tel ${alvo})  — não encontrado em nenhum canal de avisos`)
      continue
    }

    let fotoUrl = ''
    try {
      fotoUrl = await sock.profilePictureUrl(`${alvo}@s.whatsapp.net`, 'image')
    } catch {
      // fornecedor sem foto de perfil pública — fica sem avatar (fallback no front)
    }

    const entry = {
      fornecedorId: f.id,
      fornecedorNome: f.name,
      phone: (f.phone || '').replace(/\D/g, ''),
      phoneCountry: f.phoneCountry || '55',
      categorias: f.categorias || [],
      condicao: f.condicao || 'misto',
      verified: isValidado(f.lastValidatedAt),
      box: f.box || '',
      fotoUrl,
    }
    const jaExistia = JSON.stringify(groupsJson[grupo.id]) === JSON.stringify(entry)
    groupsJson[grupo.id] = entry
    if (!jaExistia) {
      atualizados++
      log(`[match-fornecedores] ✅ ${f.name}  →  ${grupo.id}  (${grupo.subject})${fotoUrl ? ' [com foto]' : ''}`)
    }
  }

  if (atualizados > 0) {
    writeFileSync(GROUPS_PATH, JSON.stringify(groupsJson, null, 2) + '\n')
    log(`[match-fornecedores] ${atualizados} entrada(s) atualizada(s) em config/groups.json.`)
  }
  return atualizados
}

// Execução direta via `npm run match-fornecedores` — checagem manual avulsa.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const { connect } = await import('./connection.js')

  const sa = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url)))
  initializeApp({ credential: cert(sa) })
  const db = getFirestore()

  await connect(null, async (sock) => {
    await syncGroupsWithFornecedores(sock, db)
    process.exit(0)
  })
}
