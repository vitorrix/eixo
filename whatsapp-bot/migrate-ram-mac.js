// Script avulso: separa o campo "ram" (memória RAM) da "capacidade"
// (armazenamento SSD) nas ofertas de Mac (MacBook/Mac mini/Mac Studio/Mac
// Pro/iMac) já gravadas em /ofertas. A extração antiga deixava a RAM
// embutida como texto dentro de produtoNome (ou, em alguns casos de um só
// número, classificava a RAM errado como capacidade — ex: "MacBook Pro M5
// 14\" 24GB" tinha capacidade="24GB" quando 24GB é RAM, não SSD).
//
// Reconstrói uma aproximação do texto bruto original (produtoNome + a
// capacidade já salva) e roda a extração corrigida de src/mapper.js nela —
// mesma técnica usada em migrate-capacidade-tamanho.js. MacBook Neo também
// tem o nome normalizado pro padrão "MacBook Neo <tela>\"" com RAM fixa em
// 8GB (regra de negócio: todo Neo vem com 8GB de RAM).
//
// Por padrão roda em modo dry-run. Pra aplicar de verdade:
// node migrate-ram-mac.js --apply
import { extractProdutoAtributos, buildDocId } from './src/mapper.js'
import { db } from './src/firestoreWriter.js'

const APPLY = process.argv.includes('--apply')
const MAC_REGEX = /macbook|mac\s*mini|mac\s*studio|mac\s*pro|imac/i

async function main() {
  const snap = await db.collection('ofertas').get()
  const alvos = snap.docs.filter(d => MAC_REGEX.test(d.data().produtoNome || ''))
  console.log(`${alvos.length} ofertas de Mac encontradas (de ${snap.size} no total). Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  let alterados = 0
  let migradosDocId = 0
  const batchOps = []

  for (const doc of alvos) {
    const data = doc.data()
    const raw = data.capacidade ? `${data.produtoNome} ${data.capacidade}` : data.produtoNome
    const { produtoNome, capacidade, ram } = extractProdutoAtributos(raw)

    const mudou = produtoNome !== data.produtoNome || capacidade !== (data.capacidade || '') || ram !== (data.ram || '')
    if (!mudou) continue
    alterados++

    const variante = [capacidade, ram, data.tamanho, data.origem, data.cor].filter(Boolean).join(' ')
    const fornecedorKey = data.fornecedorId || `raw:${data.fornecedorPhone || 'desconhecido'}`
    const newDocId = buildDocId({ fornecedorKey, produtoNome, variante, seminovo: data.seminovo })

    const newData = {
      ...data,
      produtoNome,
      produtoNomeLower: produtoNome.toLowerCase(),
      capacidade,
      ram,
      variante,
    }

    if (newDocId === doc.id) {
      console.log(`[update] ${data.produtoNome} (cap=${data.capacidade || '—'}) -> ${produtoNome} | cap=${capacidade || '—'} ram=${ram || '—'}`)
      if (APPLY) batchOps.push(() => doc.ref.update(newData))
    } else {
      migradosDocId++
      console.log(`[docId novo] ${doc.id} -> ${newDocId}\n   ${data.produtoNome} (cap=${data.capacidade || '—'}) -> ${produtoNome} | cap=${capacidade || '—'} ram=${ram || '—'}`)
      if (APPLY) {
        batchOps.push(() => db.collection('ofertas').doc(newDocId).set(newData))
        batchOps.push(() => doc.ref.delete())
      }
    }
  }

  console.log(`\n${alterados} ofertas seriam alteradas (${migradosDocId} delas mudam de docId).`)

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
