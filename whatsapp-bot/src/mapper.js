import { parseMessageWithAI } from './aiParser.js'
import { normalizeColor } from './colorMap.js'

const STORAGE_REGEX = /(\d+)\s?(GB|TB)\b/gi
const TAMANHO_REGEX = /(\d+)\s?MM\b/i

export function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, '-')
}

function toGB(num, unit) {
  return unit.toUpperCase() === 'TB' ? num * 1024 : num
}

// Separa do nome bruto a capacidade de armazenamento (GB/TB) e o tamanho da
// caixa do Apple Watch (MM) — nenhum dos dois é o nome do produto.
// Quando há DOIS números GB/TB no nome (ex: Macs, que às vezes vêm com RAM e
// armazenamento juntos — a ordem varia por fornecedor, alguns escrevem
// "8GB 256GB", outros "256GB 8GB RAM"), a capacidade real é identificada por:
// 1) a palavra "RAM" logo depois de um número marca ESSE número como RAM (não
//    capacidade), sobrando o outro; 2) sem marcação nenhuma, a capacidade é o
//    MAIOR valor — em qualquer config Apple real o armazenamento é sempre
//    maior ou igual à RAM. O valor de RAM permanece no nome (sem filtro próprio).
export function extractProdutoAtributos(produtoBruto) {
  let produtoNome = produtoBruto

  const tamanhoMatch = produtoNome.match(TAMANHO_REGEX)
  const tamanho = tamanhoMatch ? `${tamanhoMatch[1]}MM` : ''
  if (tamanhoMatch) produtoNome = produtoNome.replace(tamanhoMatch[0], '')

  const matches = [...produtoNome.matchAll(STORAGE_REGEX)]
  let escolhido = null

  if (matches.length === 1) {
    escolhido = matches[0]
  } else if (matches.length > 1) {
    const semRam = matches.filter(m => {
      const depois = produtoNome.slice(m.index + m[0].length, m.index + m[0].length + 6)
      return !/^\s*ram\b/i.test(depois)
    })
    const candidatos = semRam.length ? semRam : matches
    escolhido = candidatos.reduce((maior, m) =>
      toGB(Number(m[1]), m[2]) > toGB(Number(maior[1]), maior[2]) ? m : maior
    )
  }

  let capacidade = ''
  if (escolhido) {
    capacidade = `${escolhido[1]}${escolhido[2].toUpperCase()}`
    produtoNome = produtoNome.slice(0, escolhido.index) + produtoNome.slice(escolhido.index + escolhido[0].length)
  }

  produtoNome = produtoNome.replace(/\s+/g, ' ').trim()
  return { produtoNome, capacidade, tamanho }
}

export function buildDocId({ fornecedorKey, produtoNome, variante, seminovo }) {
  return [
    slugify(fornecedorKey),
    slugify(produtoNome),
    slugify(variante) || 'SEM-VARIANTE',
    seminovo ? 'SEMINOVO' : 'NOVO',
  ].join('__')
}

// groupMeta vem de config/groups.json (fornecedorId, fornecedorNome, phone, phoneCountry, categorias, verified)
export async function mapMessageToOfertas(text, quotedAt, groupMeta) {
  const candidatos = await parseMessageWithAI(text)

  // categorias do fornecedor = marca/tipo (apple/android/acessorios), fixo no cadastro.
  // "seminovo" NÃO entra aqui — é uma condição por produto, decidida pela IA a partir
  // do texto de cada item (um mesmo fornecedor pode vender lacrado e seminovo juntos).
  const categorias = (groupMeta.categorias || []).filter(c => c !== 'seminovo')

  return candidatos.map(c => {
    const { produtoNome, capacidade, tamanho } = extractProdutoAtributos(c.produtoBruto)
    const cor = normalizeColor(c.cor)
    const origem = (c.origem || '').trim()
    // origem entra no docId pra não colidir o mesmo modelo/cor vendido em mercados
    // diferentes (ex: mesmo iPhone Americano e Japonês, preços distintos).
    const variante = [capacidade, tamanho, origem, cor].filter(Boolean).join(' ')

    const fornecedorKey = groupMeta.fornecedorId || `raw:${groupMeta.phone || 'desconhecido'}`
    const docId = buildDocId({ fornecedorKey, produtoNome, variante, seminovo: c.seminovo })

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
        capacidade,
        tamanho,
        cor,
        origem,
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
