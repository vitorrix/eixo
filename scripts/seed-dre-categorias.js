// Popula configuracoes/operacoes.categorias com a estrutura completa do novo
// DRE (resumo_dre_baruk.docx) — o cadastro está vazio hoje, então isso é
// carga inicial, não renomeação de dado existente (ver
// scripts/migrate-dre-categorias.js pra esse outro caso).
//
// Idempotente: só adiciona categorias cujo nome ainda não existe no cadastro,
// nunca sobrescreve ou remove o que já estiver lá.
//
// Por padrão roda em modo dry-run (só mostra o que faria).
// Pra aplicar de verdade: node scripts/seed-dre-categorias.js --apply
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(
  readFileSync(new URL('../whatsapp-bot/serviceAccountKey.json', import.meta.url))
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const APPLY = process.argv.includes('--apply')

const CATEGORIAS = [
  // Bloco 1 — Receita
  { nome: 'Venda de produtos / serviços',       tipo: 'receber', grupo: 'Receita Bruta', subgrupo: null },
  { nome: 'DAS',                                 tipo: 'pagar',   grupo: 'Impostos', subgrupo: null },
  { nome: 'DARF',                                tipo: 'pagar',   grupo: 'Impostos', subgrupo: null },
  { nome: 'Taxa de Fiscalização (Anual)',        tipo: 'pagar',   grupo: 'Impostos', subgrupo: null },

  // Bloco 2 — Custo
  { nome: 'Custo dos Produtos Vendidos (CMV)',   tipo: 'pagar',   grupo: 'Custo dos Produtos Vendidos (CMV)', subgrupo: null },

  // Bloco 3 — Despesas Operacionais
  { nome: 'Salário',                             tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  { nome: 'Vale transporte / refeição',          tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  { nome: 'Comissão de vendas',                  tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  { nome: 'Benefícios / Plano de saúde',         tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },

  { nome: 'Motoboy',                             tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  { nome: 'Transporte (corridas / fretes op.)',  tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  { nome: 'Combustível',                         tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  { nome: 'Estacionamento',                      tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },

  { nome: 'Marketing (produção / criativos)',    tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Marketing & Tráfego' },
  { nome: 'Tráfego pago (Meta Ads / Google Ads)', tipo: 'pagar',  grupo: 'Despesas Operacionais', subgrupo: 'Marketing & Tráfego' },

  { nome: 'Contabilidade',                       tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Material de escritório',              tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Alimentação',                         tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Internet',                            tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Telefonia',                           tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Manutenção',                          tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Outras despesas administrativas',     tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },

  // Bloco 4 — Despesas de Vendas
  { nome: 'Embalagens',                          tipo: 'pagar',   grupo: 'Despesas de Vendas', subgrupo: null },
  { nome: 'Frete & Envios',                      tipo: 'pagar',   grupo: 'Despesas de Vendas', subgrupo: null },
  { nome: 'Outras despesas de vendas',           tipo: 'pagar',   grupo: 'Despesas de Vendas', subgrupo: null },

  // Bloco 5 — Resultado Financeiro
  { nome: 'Parcela de empréstimo',               tipo: 'pagar',   grupo: 'Resultado Financeiro', subgrupo: null },
  { nome: 'Rendimentos financeiros',             tipo: 'receber', grupo: 'Resultado Financeiro', subgrupo: null },
]

async function main() {
  console.log(`Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  const operacoesRef = db.collection('configuracoes').doc('operacoes')
  const operacoesSnap = await operacoesRef.get()
  const categoriasAtuais = operacoesSnap.exists ? (operacoesSnap.data().categorias || []) : []
  const nomesExistentes = new Set(categoriasAtuais.map(c => c.nome))

  const novas = CATEGORIAS.filter(c => !nomesExistentes.has(c.nome))
  const jaExistem = CATEGORIAS.filter(c => nomesExistentes.has(c.nome))

  console.log(`--- Cadastro atual: ${categoriasAtuais.length} categoria(s) ---`)
  console.log(`--- ${novas.length} categoria(s) nova(s) a adicionar ---`)
  novas.forEach(c => console.log(`  + ${c.nome} | ${c.tipo} | ${c.grupo}${c.subgrupo ? ' / ' + c.subgrupo : ''}`))
  if (jaExistem.length) {
    console.log(`\n--- ${jaExistem.length} já existem no cadastro (não serão duplicadas) ---`)
    jaExistem.forEach(c => console.log(`  = ${c.nome}`))
  }

  if (!APPLY) {
    console.log('\nDry-run — nada foi gravado. Rode com --apply para aplicar de verdade.')
    process.exit(0)
  }

  const categoriasFinais = [...categoriasAtuais, ...novas]
  await operacoesRef.set({ categorias: categoriasFinais }, { merge: true })
  console.log(`\nCadastro atualizado: ${categoriasFinais.length} categoria(s) no total.`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
