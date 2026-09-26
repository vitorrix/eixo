// Script avulso: aplica em /ofertas já gravadas o override de cor do iPhone 18
// Pro Max (ver MODELO_COLOR_OVERRIDES em src/colorMap.js) — unifica os nomes
// de cor pra só Azul/Preto/Branco/Bordô, por decisão do Vitor (2026-09-26).
// Cobre só docs cujo produtoNomeLower inclui "iphone 18 pro max".
//
// Unificar cores pode fazer 2+ docs antigos (ex: "Prateado" e "Glacier" do
// mesmo fornecedor/capacidade) colidirem no mesmo docId novo — nesse caso
// mantém só a oferta com quotedAt mais recente (é o preço mais atual desse
// fornecedor pra essa config) e descarta as outras, deixando log de quem foi
// descartado.
//
// Por padrão roda em modo dry-run. Pra aplicar de verdade:
// node migrate-cores-iphone18-pro-max.js --apply
import { buildDocId } from './src/mapper.js'
import { normalizeColorForProduto } from './src/colorMap.js'
import { db } from './src/firestoreWriter.js'

const APPLY = process.argv.includes('--apply')
const MODELO = 'iphone 18 pro max'

function quotedAtMillis(v) {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  return new Date(v).getTime() || 0
}

async function main() {
  const snap = await db.collection('ofertas').get()
  const docs = snap.docs.filter(d => (d.data().produtoNomeLower || '').includes(MODELO))
  console.log(`${docs.length} ofertas de iPhone 18 Pro Max encontradas (de ${snap.size} no total). Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  // Agrupa TODOS os docs do modelo (mudando cor ou não) pelo docId final —
  // é o único jeito de pegar colisão com um doc que já estava correto.
  const grupos = new Map()
  for (const doc of docs) {
    const data = doc.data()
    const cor = normalizeColorForProduto(data.produtoNome, data.cor || '')
    const variante = [data.capacidade, data.ram, data.tamanho, data.origem, cor].filter(Boolean).join(' ')
    const fornecedorKey = data.fornecedorId || `raw:${data.fornecedorPhone || 'desconhecido'}`
    const newDocId = buildDocId({ fornecedorKey, produtoNome: data.produtoNome, variante, seminovo: data.seminovo })

    if (!grupos.has(newDocId)) grupos.set(newDocId, [])
    grupos.get(newDocId).push({ doc, data, cor, variante })
  }

  let alterados = 0
  let migradosDocId = 0
  let descartados = 0
  const batchOps = []

  for (const [newDocId, itens] of grupos) {
    // Vencedor: quotedAt mais recente. Empate -> mantém o que já teria esse docId.
    const vencedor = [...itens].sort((a, b) => {
      const diff = quotedAtMillis(b.data.quotedAt) - quotedAtMillis(a.data.quotedAt)
      if (diff !== 0) return diff
      return (a.doc.id === newDocId ? -1 : 0) - (b.doc.id === newDocId ? -1 : 0)
    })[0]

    const corAntiga = vencedor.data.cor || ''
    const mudouCor = vencedor.cor !== corAntiga
    const mudouDocId = vencedor.doc.id !== newDocId

    if (itens.length > 1) {
      const perdedores = itens.filter(it => it !== vencedor)
      console.log(`[colisão] ${itens.length} ofertas -> ${newDocId}`)
      console.log(`   [mantido] ${vencedor.doc.id} — cor "${corAntiga}", preço ${vencedor.data.preco}, quotedAt ${vencedor.data.quotedAt?.toDate?.() || vencedor.data.quotedAt}`)
      perdedores.forEach(p => {
        console.log(`   [descartado] ${p.doc.id} — cor "${p.data.cor}", preço ${p.data.preco}, quotedAt ${p.data.quotedAt?.toDate?.() || p.data.quotedAt}`)
        descartados++
        if (APPLY) batchOps.push(() => p.doc.ref.delete())
      })
    }

    if (!mudouCor && !mudouDocId) continue

    alterados++
    const newData = { ...vencedor.data, cor: vencedor.cor, variante: vencedor.variante }

    if (!mudouDocId) {
      console.log(`[update] ${vencedor.data.produtoNome} — ${corAntiga} -> ${vencedor.cor}`)
      if (APPLY) batchOps.push(() => vencedor.doc.ref.update(newData))
    } else {
      migradosDocId++
      console.log(`[docId novo] ${vencedor.doc.id} -> ${newDocId}\n   ${vencedor.data.produtoNome} — ${corAntiga} -> ${vencedor.cor}`)
      if (APPLY) {
        batchOps.push(() => db.collection('ofertas').doc(newDocId).set(newData))
        batchOps.push(() => vencedor.doc.ref.delete())
      }
    }
  }

  console.log(`\n${alterados} ofertas seriam alteradas (${migradosDocId} delas mudam de docId), ${descartados} descartadas por colisão.`)

  if (APPLY) {
    console.log('\nAplicando...')
    for (const op of batchOps) await op()
    console.log('Pronto.')
  } else {
    console.log('\nDry-run — nada foi gravado. Rode com --apply para aplicar de verdade.')
  }
  process.exit(0)
}

main()
