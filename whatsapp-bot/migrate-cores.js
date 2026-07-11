// Script avulso: renomeia, nas ofertas já gravadas em /ofertas, os nomes de cor
// antigos (versão anterior de colorMap.js) para os nomes novos, oficiais, das
// planilhas cores_apple_simplificadas.xlsx + novas_cores_apple_simplificadas.xlsx.
// Só cobre renomeações SEM AMBIGUIDADE (1:1, sem risco de perder informação) —
// buckets antigos que fundiam cores distintas (ex: "Azul" pode ter sido
// Ultramarine, "Roxo" pode ter sido Lavender, "Verde" pode ter sido Sage) NÃO
// são tocados aqui, pois não dá pra saber qual era o termo original sem
// reprocessar o texto de origem. Esses se autocorrigem conforme os
// fornecedores reenviam as listas e o bot reprocessa com o mapper.js novo.
//
// Por padrão roda em modo dry-run. Pra aplicar de verdade:
// node migrate-cores.js --apply
import { buildDocId } from './src/mapper.js'
import { db } from './src/firestoreWriter.js'

const APPLY = process.argv.includes('--apply')

const RENOMEIA = {
  'Prata': 'Prateado',
  'Preto-espacial': 'Preto espacial',
  'Cinza-espacial': 'Cinza espacial',
  'Meia-noite': 'Meia noite',
  'Azul-céu': 'Azul céu',
  'Titânio Natural': 'Natural',
  'Titânio Deserto': 'Deserto',
  'Titânio Azul': 'Azul',
  'Titânio Branco': 'Branco',
  'Titânio Preto': 'Preto',
  'Preto Brilhante': 'Preto brilhante',
  'Ouro Rosa': 'Ouro rosa',
}

async function main() {
  const snap = await db.collection('ofertas').get()
  console.log(`${snap.size} ofertas encontradas. Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  let alterados = 0
  let migradosDocId = 0
  const batchOps = []

  for (const doc of snap.docs) {
    const data = doc.data()
    const corAntiga = data.cor || ''
    if (!(corAntiga in RENOMEIA)) continue

    const cor = RENOMEIA[corAntiga]
    alterados++

    const variante = [data.capacidade, data.tamanho, data.origem, cor].filter(Boolean).join(' ')
    const fornecedorKey = data.fornecedorId || `raw:${data.fornecedorPhone || 'desconhecido'}`
    const newDocId = buildDocId({ fornecedorKey, produtoNome: data.produtoNome, variante, seminovo: data.seminovo })

    const newData = { ...data, cor, variante }

    if (newDocId === doc.id) {
      console.log(`[update] ${data.produtoNome} — ${corAntiga} -> ${cor}`)
      if (APPLY) batchOps.push(() => doc.ref.update(newData))
    } else {
      migradosDocId++
      console.log(`[docId novo] ${doc.id} -> ${newDocId}\n   ${data.produtoNome} — ${corAntiga} -> ${cor}`)
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
