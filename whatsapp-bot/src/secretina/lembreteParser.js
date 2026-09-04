// Extrai um lembrete/compromisso de agenda de uma mensagem de texto livre
// (ditada por voz no WhatsApp). Mesmo padrão do aiParser.js (lançamentos):
// Claude com saída estruturada via JSON Schema. Grava em users/{uid}/agenda,
// a mesma coleção que a tela Agenda do dashboard usa — um lembrete criado
// pelo WhatsApp aparece lá normalmente.
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function diaSemanaDe(dataISO) {
  const [y, m, d] = dataISO.split('-').map(Number)
  return DIAS_SEMANA[new Date(y, m - 1, d).getDay()]
}

function buildSystemPrompt({ hoje }) {
  return `Você extrai um lembrete/compromisso de agenda de uma mensagem de WhatsApp em português, geralmente ditada por voz (pode ter erros de pontuação/vírgula do ditado). A pessoa é usuária do app SECRE·TINA (finanças pessoais), que tem uma agenda de compromissos e lembretes.

Data de hoje: ${hoje} (${diaSemanaDe(hoje)}) — use isso pra resolver datas relativas ("amanhã", "sexta-feira", "semana que vem", "dia 15").

Campos:
- valido: true se der pra extrair pelo menos um título e uma data razoáveis. Se a mensagem não for um pedido de lembrete, ou faltar completamente título ou data (e não der pra inferir), retorne valido:false com um motivo curto.
- motivo: string vazia se válido, senão explicação curta (pt-BR) do que faltou
- titulo: título curto do lembrete (ex.: "Pagar IPVA", "Consulta médica"), capitalizado, sem repetir a data
- data: YYYY-MM-DD — obrigatório, resolvido a partir da mensagem e da data de hoje
- hora: HH:MM se mencionada, senão string vazia ""
- prioridade: "alta" se parecer urgente/importante (multa, vencimento, saúde grave), "baixa" se for algo simples/sem pressa, "media" nos demais casos (padrão)
- tipo: "Pagamento" se envolver conta/boleto/fatura/dinheiro a pagar, "Saude" se for médico/consulta/exame/remédio, "Compromisso" para os demais
- obs: detalhe adicional se houver (endereço, contexto), string vazia "" se não houver`
}

const SCHEMA = {
  type: 'object',
  properties: {
    valido: { type: 'boolean' },
    motivo: { type: 'string' },
    titulo: { type: 'string' },
    data: { type: 'string' },
    hora: { type: 'string' },
    prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
    tipo: { type: 'string', enum: ['Compromisso', 'Saude', 'Pagamento'] },
    obs: { type: 'string' },
  },
  required: ['valido', 'motivo', 'titulo', 'data', 'hora', 'prioridade', 'tipo', 'obs'],
  additionalProperties: false,
}

export async function parseLembreteWithAI(texto, { hoje }) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: buildSystemPrompt({ hoje }),
    messages: [{ role: 'user', content: texto }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block) return { valido: false, motivo: 'Sem resposta da IA' }

  return JSON.parse(block.text)
}
