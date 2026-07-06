// Parser baseado no formato real observado nas comunidades: o produto (com
// capacidade) vem numa linha "cabeçalho", seguida de uma ou mais linhas de
// variante "Cor-R$Preço" (às vezes sem "R$", às vezes com espaço antes do "-").
// Exemplo real:
//   📱 iPhone 17 Pro 256GB 🇺🇸
//   ⚪Branco-R$6.500
//   🔵Azul-R$6.500
//   🟠Laranja-R$6.350
const VARIANT_REGEX = /^(?<cor>.+?)\s*-\s*(?:R\$\s*)?(?<preco>[\d.,]+)\s*$/i

// Linhas de aviso/logística que nunca são cabeçalho de produto nem variante.
const BOILERPLATE_PATTERNS = [
  /pronta entrega/i,
  /retirada\s+ou\s+envio/i,
  /^lacrado$/i,
  /somente admins/i,
  /admin da comunidade/i,
]

function stripEmoji(line) {
  return line
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseMessage(text) {
  if (!text) return []
  const lines = text.split('\n').map(stripEmoji).filter(Boolean)

  const candidates = []
  let currentHeader = null

  for (const line of lines) {
    if (BOILERPLATE_PATTERNS.some(re => re.test(line))) continue

    const variantMatch = line.match(VARIANT_REGEX)
    if (variantMatch && currentHeader) {
      const preco = parsePreco(variantMatch.groups.preco)
      if (preco != null) {
        candidates.push({
          textoOriginal: `${currentHeader} — ${line}`,
          produtoBruto: currentHeader,
          cor: variantMatch.groups.cor.trim(),
          preco,
        })
        continue
      }
    }

    // Não bateu com variante válida → é a nova linha de cabeçalho de produto.
    currentHeader = line
  }

  return candidates
}

function parsePreco(raw) {
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
