// Extrai um lançamento financeiro (secretina) de uma mensagem de texto livre
// (ditada por voz no WhatsApp). Mesmo padrão do ../aiParser.js do eixo: Claude
// com saída estruturada via JSON Schema, restrito às categorias e formas de
// pagamento que o próprio usuário já usa no app — nada de categoria inventada.
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const FORMAS = ['pix', 'debito', 'dinheiro', 'cartao', 'ticket']
const CATEGORIAS_ENTRADA = ['Salário', 'Comissão', 'Outros']

function buildSystemPrompt({ grupos, cartoes, hoje }) {
  const gruposTxto = grupos.map(g => `- ${g.nome}: ${(g.itens || []).join(', ')}`).join('\n')
  const cartoesTxto = cartoes.map(c => c.nome).join(', ') || '(nenhum cartão cadastrado)'

  return `Você extrai um lançamento financeiro de uma mensagem de WhatsApp em português, geralmente ditada por voz (pode ter erros de pontuação/vírgula do ditado). A pessoa é usuária do app SECRE·TINA (finanças pessoais).

Data de hoje: ${hoje} (use essa data se a mensagem não mencionar outra).

Primeiro decida o tipo:
- "saida": a pessoa GASTOU/PAGOU algo (é o caso mais comum)
- "entrada": a pessoa RECEBEU dinheiro (ex.: "recebi o salário", "caiu uma comissão de 500", "ganhei 200 de um extra")

Se tipo="entrada": preencha categoria com o mais próximo de Salário, Comissão ou Outros (use Outros se não for claramente um dos dois primeiros). Nesse caso grupo, item, forma e cartao_nome ficam string vazia "" — não se aplicam a entrada. parcelas=1.

Se tipo="saida" (o padrão): categoria fica vazia "" e você preenche grupo/item/forma normalmente, como abaixo.

Grupos e itens JÁ CADASTRADOS pela pessoa pra SAÍDAS (escolha o par grupo/item mais próximo do que foi dito — NUNCA invente um grupo ou item fora desta lista):
${gruposTxto}

Cartões cadastrados: ${cartoesTxto}

Forma de pagamento (só pra saída) deve ser exatamente uma de: pix, debito, dinheiro, cartao, ticket.
- "no débito"/"cartão de débito" → debito
- "no crédito"/"parcelei"/"no cartão" (sem dizer débito) → cartao — nesse caso preencha cartao_nome com o nome mais parecido da lista de cartões, e parcelas com o número de parcelas mencionado (1 se não disser).
- "no pix"/"transferi" → pix
- "dinheiro"/"espécie" → dinheiro
- "ticket"/"vale" → ticket
Se a forma de pagamento NÃO ficar clara pelo texto, deixe forma como string vazia "" — NÃO adivinhe/use um padrão. O bot vai perguntar pra pessoa qual foi a forma.

Se forma for cartao mas não ficar claro qual cartão da lista (nome não dito, ou dito mas não bate com nenhum da lista), deixe cartao_nome vazio "" — NÃO escolha um cartão por conta própria. O bot vai perguntar.

Se a mensagem claramente NÃO for um lançamento (ex.: "oi", teste, pergunta, mensagem incompreensível), retorne valido:false com um motivo curto explicando o que faltou, para o bot pedir pra pessoa reformular.

Campos:
- valido: true se for possível extrair um lançamento razoável (mesmo que forma/cartao_nome fiquem vazios por não terem ficado claros — isso é resolvido depois, não invalida a mensagem)
- motivo: string vazia se valido, senão explicação curta (pt-BR) do que faltou
- tipo: saida | entrada
- valor: número em reais (ex: 1.45), sem "R$"
- desc: descrição curta (ex: "Padaria", "Salário"), capitalizada, sem repetir o valor
- grupo: um dos grupos da lista acima (vazio "" se tipo=entrada)
- item: um dos itens daquele grupo, da lista acima (vazio "" se tipo=entrada)
- forma: pix | debito | dinheiro | cartao | ticket | "" — vazio se tipo=entrada OU se não ficou claro
- categoria: Salário | Comissão | Outros | "" — vazio "" se tipo=saida
- data: YYYY-MM-DD
- cartao_nome: nome do cartão da lista, ou string vazia se forma != cartao ou não ficou claro qual
- parcelas: número inteiro >= 1 (1 se não for parcelado, tipo=entrada, ou forma != cartao)`
}

const SCHEMA = {
  type: 'object',
  properties: {
    valido: { type: 'boolean' },
    motivo: { type: 'string' },
    tipo: { type: 'string', enum: ['saida', 'entrada'] },
    valor: { type: 'number' },
    desc: { type: 'string' },
    grupo: { type: 'string' },
    item: { type: 'string' },
    forma: { type: 'string', enum: ['', ...FORMAS] },
    categoria: { type: 'string', enum: ['', ...CATEGORIAS_ENTRADA] },
    data: { type: 'string' },
    cartao_nome: { type: 'string' },
    parcelas: { type: 'integer' },
  },
  required: ['valido', 'motivo', 'tipo', 'valor', 'desc', 'grupo', 'item', 'forma', 'categoria', 'data', 'cartao_nome', 'parcelas'],
  additionalProperties: false,
}

export async function parseLancamentoWithAI(texto, { grupos, cartoes, hoje }) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: buildSystemPrompt({ grupos, cartoes, hoje }),
    messages: [{ role: 'user', content: texto }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block) return { valido: false, motivo: 'Sem resposta da IA' }

  return JSON.parse(block.text)
}
