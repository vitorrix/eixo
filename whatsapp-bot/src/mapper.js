import { parseMessageWithAI } from './aiParser.js'
import { normalizeColor } from './colorMap.js'

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

// groupMeta vem de config/groups.json (fornecedorId, fornecedorNome, phone, phoneCountry, categorias, verified)
export async function mapMessageToOfertas(text, quotedAt, groupMeta) {
  const candidatos = await parseMessageWithAI(text)

  // categorias do fornecedor = marca/tipo (apple/android/acessorios), fixo no cadastro.
  // "seminovo" NÃO entra aqui — é uma condição por produto, decidida pela IA a partir
  // do texto de cada item (um mesmo fornecedor pode vender lacrado e seminovo juntos).
  const categorias = (groupMeta.categorias || []).filter(c => c !== 'seminovo')

  return candidatos.map(c => {
    const { produtoNome, storage } = extractProdutoEStorage(c.produtoBruto)
    const cor = normalizeColor(c.cor)
    const variante = [storage, cor].filter(Boolean).join(' ')

    const fornecedorKey = groupMeta.fornecedorId || `raw:${groupMeta.phone || 'desconhecido'}`
    const docId = [
      slugify(fornecedorKey),
      slugify(produtoNome),
      slugify(variante) || 'SEM-VARIANTE',
      c.seminovo ? 'SEMINOVO' : 'NOVO',
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
        categorias,
        seminovo: c.seminovo === true,
        preco: c.preco,
        quotedAt,
        sourceText: c.textoOriginal,
        verified: groupMeta.verified === true,
      },
    }
  })
}
