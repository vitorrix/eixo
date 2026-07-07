// Extração de ofertas via IA (Claude Haiku 4.5) — substitui o parser por regex.
// As listas dos fornecedores não seguem um formato único (hífen, "$", "=",
// "R$" antes/depois, cor e preço em linhas separadas, etc). Em vez de manter
// uma regra por fornecedor, delegamos a extração pra IA, restrita a produtos
// Apple, com saída estruturada (JSON Schema) pra garantir formato consistente.
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SYSTEM_PROMPT = `Você extrai ofertas de produtos Apple de mensagens de WhatsApp de fornecedores de eletrônicos. As mensagens vêm em formatos muito variados e inconsistentes entre fornecedores (com ou sem hífen, "R$" antes ou depois do valor, "$", "=", cor e preço às vezes em linhas separadas, preço às vezes compartilhado entre várias cores).

Extraia APENAS eletrônicos genuinamente da marca Apple: iPhone, iPad, Apple Watch, MacBook, iMac, Mac mini, Mac Studio, Mac Pro, AirPods, Apple Pencil, Magic Mouse, Magic Keyboard, AirTag.

IGNORE COMPLETAMENTE: Android, Xiaomi, Redmi, Poco, Realme, Motorola, Samsung, Garmin, drones, TVs, tablets não-Apple, e qualquer texto de propaganda, regras, horário de atendimento ou aviso. IGNORE também cabo e fonte/carregador (mesmo que originais Apple) — não são eletrônicos, não devem ser extraídos de forma alguma.

Para cada produto Apple, retorne um item por variante (cor e/ou tamanho vendida a um preço específico). Se várias cores compartilham o mesmo preço, gere um item por cor, repetindo o preço.

Campos de cada item:
- produtoBruto: nome do produto incluindo a capacidade de armazenamento se houver (ex: "iPhone 17 Pro Max 256GB", "Watch S11 42MM", "iPad 11 128GB"). NUNCA inclua a palavra "Apple" no nome — é redundante (todo produto aqui já é Apple). Ex: "Apple Watch Ultra 3 49MM" vira "Watch Ultra 3 49MM"; "Apple Pencil Pro" vira "Pencil Pro"; "Apple AirTag 4 Pack" vira "AirTag 4 Pack". Mantenha o resto do nome intacto.
- cor: a cor/variante específica (ex: "Azul", "Preto", "Space Black"). String vazia se não houver cor definida.
- preco: valor numérico em reais, sem formatação, sem "R$", sem separador de milhar (ex: 6500, não "R$ 6.500" nem "6.500,00")
- seminovo: true se ESSE item específico for usado/seminovo, false se for novo/lacrado. Sinais de seminovo: emoji ♻️ perto do item, palavras "seminovo"/"semi-novo"/"semi novo"/"usado"/"vitrine"/"outlet", "CPO" (Certified Pre-Owned), classificação por grade de bateria ("GRADE A"/"GRADE B"/"GRADE AB") ou percentual de bateria ("Bateria acima de X%", "🔋90+", "🔋85-89" etc). Sinais de novo/lacrado: palavras "lacrado"/"novo"/"selado", "🔒LACRADO🔒", ausência de qualquer sinal de uso. IMPORTANTE: uma mesma mensagem pode ter produtos lacrados E seminovos misturados em seções diferentes — classifique cada item individualmente pelo contexto mais próximo dele, não pela mensagem inteira. Na dúvida (nenhum sinal em nenhuma direção), use false.

IMPORTANTE — nunca inclua nome de cor dentro de produtoBruto. Alguns fornecedores escrevem o cabeçalho do produto já com um nome de cor (ex: "Apple Watch S11 42MM Jet Black"), mas depois listam cores DIFERENTES com seus preços nas linhas seguintes (ex: "Preto-R$2.150" e "Rose Gold-R$2.050"). Nesse caso, a cor do cabeçalho não é a cor real da variante — é só texto residual do nome usado pelo fornecedor. Remova qualquer cor do produtoBruto e use exclusivamente a cor da linha de variante no campo cor, mesmo que ela pareça contradizer o cabeçalho.

Se não houver nenhum produto Apple na mensagem, retorne uma lista vazia.`

const SCHEMA = {
  type: 'object',
  properties: {
    ofertas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          produtoBruto: { type: 'string' },
          cor: { type: 'string' },
          preco: { type: 'number' },
          seminovo: { type: 'boolean' },
        },
        required: ['produtoBruto', 'cor', 'preco', 'seminovo'],
        additionalProperties: false,
      },
    },
  },
  required: ['ofertas'],
  additionalProperties: false,
}

export async function parseMessageWithAI(text) {
  if (!text || !text.trim()) return []

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block) return []

  const parsed = JSON.parse(block.text)
  return parsed.ofertas.map(o => ({
    produtoBruto: o.produtoBruto,
    cor: o.cor,
    preco: o.preco,
    seminovo: o.seminovo === true,
    textoOriginal: text,
  }))
}
