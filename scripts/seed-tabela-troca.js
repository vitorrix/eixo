// Popula configuracoes/tabelaTroca com a lista-base de modelos/capacidades
// (valor 0 — a preencher em Configurações > Tabela de Troca). Só roda se o
// documento ainda não existir — não sobrescreve valores já cadastrados.
//
// Por padrão roda em modo dry-run (só mostra o que faria).
// Pra aplicar de verdade: node scripts/seed-tabela-troca.js --apply
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Duplicada de src/modules/configuracoes/tabTabelaTroca.js (TABELA_TROCA_PADRAO)
// de propósito — esse módulo importa src/firebase.js, que depende de
// import.meta.env do Vite e não roda em Node puro (mesmo motivo de
// seed-dre-categorias.js duplicar a lista de categorias em vez de importar).
const TABELA_TROCA_PADRAO = [
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro Max', capacidade: '2TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone Air',        capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17',         capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17e',        capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 17', modelo: 'iPhone 17e',        capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16 Plus',    capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16',         capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 16', modelo: 'iPhone 16e',        capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15 Plus',    capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 15', modelo: 'iPhone 15',         capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14 Plus',    capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 14', modelo: 'iPhone 14',         capacidade: '512GB', valor: 0 },

  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro Max', capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 Pro',     capacidade: '1TB',   valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13',         capacidade: '512GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    capacidade: '128GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    capacidade: '256GB', valor: 0 },
  { linha: 'iPhone 13', modelo: 'iPhone 13 mini',    capacidade: '512GB', valor: 0 },

  { linha: 'Apple Watch', modelo: 'Apple Watch Series 4', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 5', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 6', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 7', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 8', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Series 9', capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Ultra 1',  capacidade: null, valor: 0 },
  { linha: 'Apple Watch', modelo: 'Apple Watch Ultra 2',  capacidade: null, valor: 0 },
]

const serviceAccount = JSON.parse(
  readFileSync(new URL('../whatsapp-bot/serviceAccountKey.json', import.meta.url))
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  const ref  = db.collection('configuracoes').doc('tabelaTroca')
  const snap = await ref.get()

  if (snap.exists) {
    const atual = snap.data().itens || []
    console.log(`Documento já existe com ${atual.length} item(ns) — nada a fazer (script só faz carga inicial).`)
    process.exit(0)
  }

  console.log(`--- ${TABELA_TROCA_PADRAO.length} item(ns) a cadastrar ---`)
  const grupos = [...new Set(TABELA_TROCA_PADRAO.map(i => i.linha))]
  grupos.forEach(g => {
    const n = TABELA_TROCA_PADRAO.filter(i => i.linha === g).length
    console.log(`  ${g}: ${n} item(ns)`)
  })

  if (!APPLY) {
    console.log('\nDry-run — nada foi gravado. Rode com --apply para aplicar de verdade.')
    process.exit(0)
  }

  await ref.set({ itens: TABELA_TROCA_PADRAO })
  console.log(`\nTabela de troca criada com ${TABELA_TROCA_PADRAO.length} item(ns).`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
