// Migração pontual pra reestruturação do DRE (decisões em
// resumo_dre_baruk.docx): renomeia categorias antigas pro novo padrão
// grupo/subgrupo tanto no cadastro (configuracoes/operacoes.categorias)
// quanto nos lançamentos já gravados em /financeiro, e acrescenta as
// categorias novas sem histórico (Impostos, Rendimentos financeiros).
//
// Por padrão roda em modo dry-run (só lê e mostra o que faria).
// Pra aplicar de verdade: node scripts/migrate-dre-categorias.js --apply
import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccount = JSON.parse(
  readFileSync(new URL('../whatsapp-bot/serviceAccountKey.json', import.meta.url))
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const APPLY = process.argv.includes('--apply')

// Mapa de renomeações — seção 3 (Mapa de Renomeações) do documento.
const RENOMEIA = {
  'Convênio':               { nome: 'Benefícios / Plano de saúde',            tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  'Comissão':               { nome: 'Comissão de vendas',                     tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  'Vale':                   { nome: 'Vale transporte / refeição',             tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  'Transporte':             { nome: 'Transporte (corridas / fretes op.)',     tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  'Motoboy':                { nome: 'Motoboy',                                tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  'Combustível':            { nome: 'Combustível',                            tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  'Estacionamento':         { nome: 'Estacionamento',                         tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Logística & Transporte' },
  'Tráfego Pago':           { nome: 'Tráfego pago (Meta Ads / Google Ads)',   tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Marketing & Tráfego' },
  'Marketing':              { nome: 'Marketing (produção / criativos)',       tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Marketing & Tráfego' },
  'Contabilidade':          { nome: 'Contabilidade',                          tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Material de escritório': { nome: 'Material de escritório',                 tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Alimentação':            { nome: 'Alimentação',                           tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Internet':               { nome: 'Internet',                              tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Telefonia':              { nome: 'Telefonia',                             tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Manutenção':             { nome: 'Manutenção',                            tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Outras despesas':        { nome: 'Outras despesas administrativas',        tipo: 'pagar', grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  'Fretes':                 { nome: 'Frete & Envios',                        tipo: 'pagar', grupo: 'Despesas de Vendas' },
  'Melhor Envio':           { nome: 'Frete & Envios',                        tipo: 'pagar', grupo: 'Despesas de Vendas' },
  'Troca com Troco':        { nome: 'Outras despesas de vendas',              tipo: 'pagar', grupo: 'Despesas de Vendas' },
  'Embalagens':             { nome: 'Embalagens',                            tipo: 'pagar', grupo: 'Despesas de Vendas' },
  'Empréstimo':             { nome: 'Parcela de empréstimo',                  tipo: 'pagar', grupo: 'Resultado Financeiro' },
}

// Categorias que já existem e só mudam de grupo (nome/tipo continuam iguais).
const RECLASSIFICA = {
  'Venda de produtos/serviços': { grupo: 'Receita Bruta' },
  'Rendimentos financeiros':    { grupo: 'Resultado Financeiro' },
}

// Categorias novas, sem lançamento histórico — só entram se ainda não existir
// uma categoria com esse nome no cadastro.
const NOVAS = [
  { nome: 'DAS',                            tipo: 'pagar',   grupo: 'Impostos',           subgrupo: null },
  { nome: 'DARF',                           tipo: 'pagar',   grupo: 'Impostos',           subgrupo: null },
  { nome: 'Taxa de Fiscalização (Anual)',   tipo: 'pagar',   grupo: 'Impostos',           subgrupo: null },
  { nome: 'Rendimentos financeiros',        tipo: 'receber', grupo: 'Resultado Financeiro', subgrupo: null },
]

function normalizada(c, novoGrupo, novoSubgrupo) {
  return { nome: c.nome, tipo: c.tipo, grupo: novoGrupo, subgrupo: novoSubgrupo ?? null }
}

async function main() {
  console.log(`Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  const operacoesRef = db.collection('configuracoes').doc('operacoes')
  const operacoesSnap = await operacoesRef.get()
  const categoriasAtuais = operacoesSnap.exists ? (operacoesSnap.data().categorias || []) : []

  console.log(`--- Categorias cadastradas hoje (${categoriasAtuais.length}) ---`)
  categoriasAtuais.forEach(c => {
    const grupoAtual = c.grupo || c.grupoDRE || '—'
    const alvo = RENOMEIA[c.nome] || (RECLASSIFICA[c.nome] ? { nome: c.nome, ...RECLASSIFICA[c.nome] } : null)
    const seta = alvo ? ` → "${alvo.nome}" (${alvo.grupo}${alvo.subgrupo ? ' / ' + alvo.subgrupo : ''})` : ' — fora do mapa, não será alterada'
    console.log(`  ${c.nome} | tipo=${c.tipo} | grupo atual=${grupoAtual}${seta}`)
  })

  const nomesDuplicados = categoriasAtuais
    .map(c => c.nome)
    .filter((nome, i, arr) => arr.indexOf(nome) !== i)
  if (nomesDuplicados.length) {
    console.log(`\n⚠ Nomes de categoria duplicados no cadastro (revisar manualmente, não são migrados automaticamente):`)
    ;[...new Set(nomesDuplicados)].forEach(n => console.log(`  - ${n}`))
  }

  const financeiroSnap = await db.collection('financeiro').get()
  console.log(`\n--- ${financeiroSnap.size} lançamentos em /financeiro ---`)
  const contagem = {}
  financeiroSnap.docs.forEach(d => {
    const cat = d.data().categoria || '(sem categoria)'
    contagem[cat] = (contagem[cat] || 0) + 1
  })
  Object.entries(contagem).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    const alvo = RENOMEIA[cat]
    console.log(`  ${String(n).padStart(4)}x  ${cat}${alvo ? ` → renomeia para "${alvo.nome}"` : ''}`)
  })

  const semMapa = Object.keys(contagem).filter(cat => !RENOMEIA[cat] && cat !== '(sem categoria)')
  if (semMapa.length) {
    console.log(`\n⚠ Categorias em uso em lançamentos que NÃO estão no mapa de renomeações (não serão tocadas):`)
    semMapa.forEach(cat => console.log(`  - ${cat}`))
  }

  if (!APPLY) {
    console.log('\nDry-run — nada foi gravado. Revise a saída acima e rode com --apply para aplicar de verdade.')
    process.exit(0)
  }

  // ── Reescreve o cadastro de categorias ──────────────────────────────────
  const nomesJaVistos = new Set()
  const novasCategorias = []
  for (const c of categoriasAtuais) {
    if (nomesDuplicados.includes(c.nome)) { novasCategorias.push(c); continue }
    const ren = RENOMEIA[c.nome]
    const reclass = RECLASSIFICA[c.nome]
    let novo
    if (ren) novo = normalizada(c, ren.grupo, ren.subgrupo)
    else if (reclass) novo = normalizada(c, reclass.grupo, c.subgrupo)
    else { novasCategorias.push(c); continue }
    if (nomesJaVistos.has(novo.nome)) continue // ex: Fretes + Melhor Envio -> mesma categoria nova
    nomesJaVistos.add(novo.nome)
    novasCategorias.push(novo)
  }
  for (const nova of NOVAS) {
    if (!novasCategorias.some(c => c.nome === nova.nome)) novasCategorias.push(nova)
  }
  await operacoesRef.set({ categorias: novasCategorias }, { merge: true })
  console.log(`\nCategorias atualizadas (${novasCategorias.length}).`)

  // ── Renomeia categoria nos lançamentos já gravados ──────────────────────
  const paraRenomear = financeiroSnap.docs.filter(d => RENOMEIA[d.data().categoria])
  let renomeados = 0
  for (let i = 0; i < paraRenomear.length; i += 400) {
    const chunk = paraRenomear.slice(i, i + 400)
    const batch = db.batch()
    chunk.forEach(doc => batch.update(doc.ref, { categoria: RENOMEIA[doc.data().categoria].nome }))
    await batch.commit()
    renomeados += chunk.length
  }
  console.log(`${renomeados} lançamentos renomeados.`)

  console.log('\nPronto.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
