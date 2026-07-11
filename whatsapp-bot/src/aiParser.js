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
- produtoBruto: nome do produto incluindo a capacidade de armazenamento se houver (ex: "iPhone 17 Pro Max 256GB", "Watch S11 42MM", "iPad 11 128GB"). NUNCA inclua a palavra "Apple" no nome — é redundante (todo produto aqui já é Apple). Ex: "Apple Watch Ultra 3 49MM" vira "Watch Ultra 3 49MM"; "Apple Pencil Pro" vira "Pencil Pro"; "Apple AirTag 4 Pack" vira "AirTag 4 Pack". Mantenha o resto do nome intacto. NUNCA inclua a origem/mercado do aparelho aqui (ver campo "origem" abaixo). IMPORTANTE — MacBook/iMac/Mac mini/Mac Studio/Mac Pro costumam especificar RAM e armazenamento (SSD) juntos, em formatos variados ("24GB | 512GB", "24GB/512GB", "16GB 512GB SSD"). Inclua SEMPRE os DOIS números em produtoBruto, na mesma ordem em que aparecem no texto original (ex: "MACBOOK PRO M5 14” 24GB | 512GB" vira produtoBruto "MacBook Pro M5 14\" 24GB 512GB"). Se o mesmo cabeçalho de Mac listar mais de uma combinação de RAM+armazenamento com preços diferentes (ex: 24GB|512GB por R$13.990 e 24GB|1TB por R$14.250), gere um item por combinação — mesmo que a RAM seja igual entre elas — do mesmo jeito que cores diferentes geram itens separados. NUNCA omita o número de armazenamento de um Mac quando ele aparecer no texto, mesmo que a RAM já tenha sido mencionada.
- cor: a cor/variante específica (ex: "Azul", "Preto", "Space Black"). String vazia se não houver cor definida.
- origem: o mercado/região de procedência do aparelho, quando indicado (ex: "Americano", "Japonês", "Indiano", "Árabe", "Chinês", "Europeu"). Reconheça tanto o nome por extenso quanto códigos de modelo da Apple: LL/A ou US = Americano; J/A = Japonês; ZP/A = Indiano; KH/A ou A/A = Árabe/Emirados; CH/A = Chinês; B/A = Europeu. Isso é uma dimensão SEPARADA de "seminovo"/CPO — um aparelho pode ser, por exemplo, "seminovo CPO americano". String vazia se a origem não for indicada. IMPORTANTE: dois itens do mesmo produto/cor mas origens diferentes são ofertas DISTINTAS com preços possivelmente diferentes — nunca as junte nem descarte a origem de uma delas.
- preco: valor numérico em reais, sem formatação, sem "R$", sem separador de milhar (ex: 6500, não "R$ 6.500" nem "6.500,00")
- seminovo: true se ESSE item específico for usado/seminovo, false se for novo/lacrado. Sinais de seminovo: palavras "seminovo"/"semi-novo"/"semi novo"/"usado"/"vitrine"/"outlet", "CPO" (Certified Pre-Owned), classificação por grade de bateria ("GRADE A"/"GRADE B"/"GRADE AB") ou percentual de bateria ("Bateria acima de X%", "🔋90+", "🔋85-89" etc). Sinais de novo/lacrado: palavras "lacrado"/"novo"/"selado", "🔒LACRADO🔒", ausência de qualquer sinal de uso. NÃO use emojis genéricos (♻️ ou similares) como sinal de seminovo — vários fornecedores usam esse tipo de emoji só como marcador decorativo de lista, na frente de item novo ou usado indistintamente; conte apenas com palavras/marcadores textuais inequívocos. IMPORTANTE: uma mesma mensagem pode ter produtos lacrados E seminovos misturados em seções diferentes — classifique cada item individualmente pelo contexto mais próximo dele, não pela mensagem inteira. Na dúvida (nenhum sinal textual em nenhuma direção), use false.

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
          origem: { type: 'string' },
          preco: { type: 'number' },
          seminovo: { type: 'boolean' },
        },
        required: ['produtoBruto', 'cor', 'origem', 'preco', 'seminovo'],
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
    max_tokens: 8192, // listas grandes (60+ itens) já chegaram perto do limite de 4096 e cortaram o JSON no meio
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block) return []

  if (response.stop_reason === 'max_tokens') {
    throw new Error(`Resposta da IA cortada por max_tokens (lista com ${text.length} caracteres) — oferta(s) perdida(s) nessa mensagem.`)
  }

  let parsed
  try {
    parsed = JSON.parse(block.text)
  } catch (err) {
    throw new Error(`JSON inválido da IA (stop_reason=${response.stop_reason}, ${block.text.length} chars): ${err.message}`)
  }
  return parsed.ofertas.map(o => ({
    produtoBruto: o.produtoBruto,
    cor: o.cor,
    origem: o.origem,
    preco: o.preco,
    seminovo: o.seminovo === true,
    textoOriginal: text,
  }))
}
