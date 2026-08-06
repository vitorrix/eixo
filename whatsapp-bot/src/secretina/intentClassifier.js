// Primeira passada, barata, pra decidir o que fazer com a mensagem antes de
// gastar uma chamada mais cara de extração/resposta.
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const SCHEMA = {
  type: 'object',
  properties: { tipo: { type: 'string', enum: ['lancamento', 'pergunta', 'outro'] } },
  required: ['tipo'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `Classifique a mensagem de WhatsApp de um app de finanças pessoais (SECRE·TINA) em uma categoria:
- "lancamento": a pessoa está relatando um gasto ou entrada que aconteceu (ex.: "gastei 50 no mercado", "paguei a conta de luz", "recebi o salário")
- "pergunta": a pessoa está perguntando sobre a própria situação financeira (ex.: "quanto gastei esse mês?", "qual meu saldo?", "quanto falta no orçamento?", "quanto tá a fatura do cartão?", "quais foram meus últimos gastos?")
- "outro": qualquer outra coisa (saudação, mensagem incompreensível, assunto não financeiro)`

export async function classificarIntencao(texto) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 64,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: texto }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })
  const block = response.content.find(b => b.type === 'text')
  if (!block) return 'outro'
  try {
    return JSON.parse(block.text).tipo
  } catch {
    return 'outro'
  }
}
