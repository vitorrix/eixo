import { parseMessage } from './parser.js'

const STORAGE_REGEX = /(\d+)\s?(GB|TB)\b/i

function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, '-')
}

function extractProdutoEStorage(produtoBruto) {
  const storageMatch = produtoBruto.match(STORAGE_REGEX)
  const storage = storageMatch ? `${storageMatch[1]}${storageMatch[2].toUpperCase()}` : ''

  let produtoNome = produtoBruto
  if (storageMatch) produtoNome = produtoNome.replace(storageMatch[0], '')
  produtoNome = produtoNome.replace(/\s+/g, ' ').trim()

  return { produtoNome, storage }
}

// groupMeta vem de config/groups.json (fornecedorId, fornecedorNome, phone, phoneCountry, categoria, verified)
export function mapMessageToOfertas(text, quotedAt, groupMeta) {
  const candidatos = parseMessage(text)

  return candidatos.map(c => {
    const { produtoNome, storage } = extractProdutoEStorage(c.produtoBruto)
    const variante = [storage, c.cor].filter(Boolean).join(' ')

    const fornecedorKey = groupMeta.fornecedorId || `raw:${groupMeta.phone || 'desconhecido'}`
    const docId = [
      slugify(fornecedorKey),
      slugify(produtoNome),
      slugify(variante) || 'SEM-VARIANTE',
    ].join('__')

    return {
      docId,
      data: {
        fornecedorId: groupMeta.fornecedorId || null,
        fornecedorNome: groupMeta.fornecedorNome || '',
        fornecedorPhone: groupMeta.phone || '',
        fornecedorPhoneCountry: groupMeta.phoneCountry || '55',
        fornecedorFotoUrl: groupMeta.fotoUrl || '',
        box: groupMeta.box || '',
        produtoNome,
        produtoNomeLower: produtoNome.toLowerCase(),
        variante,
        categoria: groupMeta.categoria || '',
        preco: c.preco,
        quotedAt,
        sourceText: c.textoOriginal,
        verified: groupMeta.verified === true,
      },
    }
  })
}
