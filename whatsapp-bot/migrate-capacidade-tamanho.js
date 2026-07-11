// Script avulso: corrige as ofertas já gravadas em /ofertas com a extração
// antiga (capacidade confundida com RAM; tamanho do Apple Watch embutido no
// nome). Reconstrói o nome bruto original a partir do que já está salvo e
// reaplica a extração corrigida de src/mapper.js.
//
// Por padrão roda em modo dry-run (só mostra o que mudaria). Pra aplicar de
// verdade: node migrate-capacidade-tamanho.js --apply
import { extractProdutoAtributos, buildDocId } from './src/mapper.js'
import { db } from './src/firestoreWriter.js'

const APPLY = process.argv.includes('--apply')

const ORIGEM_LABELS = {
  'americano': 'Americano', 'japones': 'Japonês', 'indiano': 'Indiano',
  'arabe': 'Árabe', 'chines': 'Chinês', 'europeu': 'Europeu',
}
function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Reconstrói { origem, cor } a partir da "variante" antiga, que era
// [storageAntigo, origem, cor].filter(Boolean).join(' ').
function splitOldVariante(variante, oldStorageToken) {
  let resto = (variante || '').trim()
  if (oldStorageToken && resto.startsWith(oldStorageToken)) {
    resto = resto.slice(oldStorageToken.length).trim()
  }
  let origem = ''
  const m = resto.match(/^(\S+)\s*(.*)$/)
  if (m) {
    const label = ORIGEM_LABELS[stripAccents(m[1]).toLowerCase()]
    if (label) {
      origem = label
      resto = m[2].trim()
    }
  }
  return { origem, cor: resto }
}

// A extração antiga só removia o PRIMEIRO número GB/TB do nome (achando que
// era a capacidade). Reinserimos esse token de volta no nome, na posição
// onde ele originalmente estava (antes do próximo token GB/TB restante, se
// houver — caso RAM+capacidade — senão no final), pra reconstruir o nome
// bruto original e rodar a extração corrigida nele.
function reconstructRaw(produtoNome, oldStorageToken) {
  if (!oldStorageToken) return produtoNome
  const m = produtoNome.match(/\d+\s?(?:GB|TB)\b/i)
  if (m) return produtoNome.slice(0, m.index) + oldStorageToken + ' ' + produtoNome.slice(m.index)
  return `${produtoNome} ${oldStorageToken}`.trim()
}

async function main() {
  const snap = await db.collection('ofertas').get()
  console.log(`${snap.size} ofertas encontradas. Modo: ${APPLY ? 'APLICANDO' : 'DRY-RUN (nada será gravado)'}\n`)

  let alterados = 0
  let migradosDocId = 0
  const batchOps = []

  for (const doc of snap.docs) {
    const data = doc.data()
    const oldStorageMatch = (data.variante || '').match(/^(\d+\s?(?:GB|TB))/i)
    const oldStorageToken = oldStorageMatch ? oldStorageMatch[0] : ''
    const oldStorage = oldStorageToken ? oldStorageToken.replace(/\s+/g, '').toUpperCase() : ''

    const { origem, cor } = splitOldVariante(data.variante, oldStorageToken)
    const raw = reconstructRaw(data.produtoNome || '', oldStorage)
    const { produtoNome, capacidade, tamanho } = extractProdutoAtributos(raw)
    const variante = [capacidade, tamanho, origem, cor].filter(Boolean).join(' ')

    const mudou = produtoNome !== data.produtoNome || capacidade !== (data.capacidade || '') ||
      tamanho !== (data.tamanho || '') || cor !== (data.cor || '') || origem !== (data.origem || '')
    if (!mudou) continue
    alterados++

    const fornecedorKey = data.fornecedorId || `raw:${data.fornecedorPhone || 'desconhecido'}`
    const newDocId = buildDocId({ fornecedorKey, produtoNome, variante, seminovo: data.seminovo })

    const newData = {
      ...data,
      produtoNome,
      produtoNomeLower: produtoNome.toLowerCase(),
      capacidade,
      tamanho,
      cor,
      origem,
      variante,
    }

    if (newDocId === doc.id) {
      console.log(`[update] ${data.produtoNome} (${data.variante || '—'}) -> ${produtoNome} | cap=${capacidade || '—'} tam=${tamanho || '—'} cor=${cor || '—'} origem=${origem || '—'}`)
      if (APPLY) batchOps.push(() => doc.ref.update(newData))
    } else {
      migradosDocId++
      console.log(`[docId novo] ${doc.id} -> ${newDocId}\n   ${data.produtoNome} (${data.variante || '—'}) -> ${produtoNome} | cap=${capacidade || '—'} tam=${tamanho || '—'} cor=${cor || '—'} origem=${origem || '—'}`)
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
