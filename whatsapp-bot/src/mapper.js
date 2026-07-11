import { parseMessageWithAI } from './aiParser.js'
import { normalizeColor } from './colorMap.js'

const STORAGE_REGEX = /(\d+)\s?(GB|TB)\b/gi
const TAMANHO_REGEX = /(\d+)\s?MM\b/i
const TELA_MACBOOK_REGEX = /(\d{1,2}(?:[.,]\d)?)\s*(?:"|”|'|inch|polegadas?|-inch)/i

// Valores de RAM que a Apple nunca vende como capacidade de SSD sozinha —
// quando aparecem como o ÚNICO número de um Mac, são RAM, não armazenamento.
const RAM_ONLY_VALUES = new Set([8, 16, 18, 24, 32, 36, 48, 64, 96])

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

// MacBook Neo é sempre vendido com 8GB de RAM (fixo, não varia por anúncio) e
// fornecedores escrevem o nome de formas muito inconsistentes ("Neo 13\"",
// "NEO 8/ 13\"", "Neo 13-inch", "Air NEO 13\" +8GB" etc). Normaliza pro
// padrão "MacBook Neo <tela>\"", extraindo só o tamanho de tela do texto
// bruto (13 como padrão se a tela não vier especificada).
function extrairTelaMacBookNeo(produtoBruto) {
  const m = produtoBruto.match(TELA_MACBOOK_REGEX)
  return m ? m[1].replace(',', '.') : '13'
}

// Separa do nome bruto a capacidade de armazenamento (GB/TB), a RAM e o
// tamanho da caixa do Apple Watch (MM) — nenhum desses é o nome do produto.
// Macs costumam vir com RAM e armazenamento juntos (ordem varia por
// fornecedor: "8GB 256GB", "256GB 8GB RAM", "24GB | 512GB"). A capacidade
// real (armazenamento) é identificada por, em ordem de prioridade:
// 1) a palavra "RAM" logo depois de um número marca ESSE número como RAM,
//    sobrando o outro como capacidade;
// 2) com dois números e nenhuma marcação, a capacidade é o MAIOR valor —
//    em qualquer config Apple real o armazenamento é sempre maior ou igual
//    à RAM;
// 3) com um único número e nenhuma marcação, valores que a Apple nunca
//    vende como SSD sozinho (8/16/18/24/32/36/48/64/96GB) são RAM, não
//    capacidade — o resto é tratado como capacidade.
export function extractProdutoAtributos(produtoBruto) {
  let produtoNome = produtoBruto

  const tamanhoMatch = produtoNome.match(TAMANHO_REGEX)
  const tamanho = tamanhoMatch ? `${tamanhoMatch[1]}MM` : ''
  if (tamanhoMatch) produtoNome = produtoNome.replace(tamanhoMatch[0], '')

  const matches = [...produtoNome.matchAll(STORAGE_REGEX)]
  let capacidadeMatch = null
  let ramMatch = null

  const comRam = matches.find(m => {
    const depois = produtoNome.slice(m.index + m[0].length, m.index + m[0].length + 6)
    return /^\s*ram\b/i.test(depois)
  })

  if (comRam) {
    ramMatch = comRam
    const resto = matches.filter(m => m !== comRam)
    if (resto.length) {
      capacidadeMatch = resto.reduce((maior, m) =>
        toGB(Number(m[1]), m[2]) > toGB(Number(maior[1]), maior[2]) ? m : maior
      )
    }
  } else if (matches.length === 2) {
    const [a, b] = matches
    if (toGB(Number(a[1]), a[2]) >= toGB(Number(b[1]), b[2])) { capacidadeMatch = a; ramMatch = b }
    else { capacidadeMatch = b; ramMatch = a }
  } else if (matches.length === 1) {
    const valor = toGB(Number(matches[0][1]), matches[0][2])
    if (RAM_ONLY_VALUES.has(valor)) ramMatch = matches[0]
    else capacidadeMatch = matches[0]
  } else if (matches.length > 2) {
    const ordenados = [...matches].sort((x, y) => toGB(Number(y[1]), y[2]) - toGB(Number(x[1]), x[2]))
    capacidadeMatch = ordenados[0]
    ramMatch = ordenados[1]
  }

  const paraRemover = [capacidadeMatch, ramMatch].filter(Boolean).sort((a, b) => b.index - a.index)
  for (const m of paraRemover) {
    let fim = m.index + m[0].length
    if (m === comRam) {
      const palavraRam = produtoNome.slice(fim).match(/^\s*ram\b\s*/i)
      if (palavraRam) fim += palavraRam[0].length
    }
    produtoNome = produtoNome.slice(0, m.index) + produtoNome.slice(fim)
  }

  const capacidade = capacidadeMatch ? `${capacidadeMatch[1]}${capacidadeMatch[2].toUpperCase()}` : ''
  let ram = ramMatch ? `${ramMatch[1]}${ramMatch[2].toUpperCase()}` : ''

  // Alguns fornecedores de Mac escrevem a RAM sem unidade, só com "/" ou "+"
  // depois do número (ex: "Mac Mini M4 16/", "iMac M4 24\" 16/ 8GPU").
  if (!ram) {
    const abreviada = produtoNome.match(/\b(\d{1,3})\s?[/+]/)
    if (abreviada && RAM_ONLY_VALUES.has(Number(abreviada[1]))) {
      ram = `${abreviada[1]}GB`
      produtoNome = produtoNome.slice(0, abreviada.index) + produtoNome.slice(abreviada.index + abreviada[0].length)
    }
  }

  // "SSD", "/" e "+" costumam ficar sobrando colados no número de RAM
  // removido (ex: "16GB SSD", "Mac Mini M4 16/", "14.2\" +24GB") — sem
  // valor sozinhos no nome.
  if (capacidadeMatch || ramMatch || ram) {
    produtoNome = produtoNome.replace(/\bSSD\b/gi, '').replace(/[/+]/g, ' ')
  }
  produtoNome = produtoNome.replace(/\s+/g, ' ').trim()

  if (/macbook/i.test(produtoNome) && /\bneo\b/i.test(produtoNome)) {
    produtoNome = `MacBook Neo ${extrairTelaMacBookNeo(produtoBruto)}"`
    ram = '8GB'
  }

  return { produtoNome, capacidade, ram, tamanho }
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
    const { produtoNome, capacidade, ram, tamanho } = extractProdutoAtributos(c.produtoBruto)
    const cor = normalizeColor(c.cor)
    const origem = (c.origem || '').trim()
    // origem entra no docId pra não colidir o mesmo modelo/cor vendido em mercados
    // diferentes (ex: mesmo iPhone Americano e Japonês, preços distintos). ram entra
    // pra não colidir duas configs de RAM com a mesma capacidade de SSD (ex: MacBook
    // Pro 14" 1TB com 16GB ou 24GB de RAM são ofertas/preços distintos).
    const variante = [capacidade, ram, tamanho, origem, cor].filter(Boolean).join(' ')

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
        ram,
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
