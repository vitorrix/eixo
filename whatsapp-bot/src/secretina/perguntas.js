// Responde perguntas sobre a situação financeira da pessoa (ex.: "quanto
// gastei esse mês?", "qual meu saldo?", "quanto tá a fatura do cartão?").
// Monta um resumo numérico a partir dos dados reais do Firestore e deixa o
// Claude formular a resposta em português — sem inventar números, só os que
// estão no resumo.
import Anthropic from '@anthropic-ai/sdk'
import { getFaturaKey } from './firestoreWriter.js'

const client = new Anthropic()

function montarContexto({ lancamentos, cartoes, saldoInicial, orcamento, mesKey }) {
  const saidas = lancamentos.filter(l => l.tipo === 'saida')
  const entradas = lancamentos.filter(l => l.tipo === 'entrada')
  const totalSaidas = saidas.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0)
  const totalEntradas = entradas.reduce((a, b) => a + (parseFloat(b.valor) || 0), 0)

  const porGrupo = {}
  saidas.forEach(l => { porGrupo[l.grupo] = (porGrupo[l.grupo] || 0) + (parseFloat(l.valor) || 0) })

  const faturasCartao = cartoes.map(c => {
    const fatura = lancamentos
      .filter(l => l.tipo === 'saida' && l.cartao_nome === c.nome && getFaturaKey(l.data, c.fechamento || 1) === mesKey)
      .reduce((a, b) => a + (parseFloat(b.valor) || 0), 0)
    return { nome: c.nome, faturaAtualDoMes: Number(fatura.toFixed(2)), limite: c.limite ?? null }
  })

  const orcamentoTotal = Object.values(orcamento).reduce((a, b) => a + (parseFloat(b) || 0), 0)

  return {
    mes: mesKey,
    saldoAnteriorDefinidoManualmente: saldoInicial[mesKey] ?? null,
    totalEntradasNoMes: Number(totalEntradas.toFixed(2)),
    totalSaidasNoMes: Number(totalSaidas.toFixed(2)),
    orcamentoTotalDoMes: orcamentoTotal || null,
    gastoPorGrupoNoMes: Object.fromEntries(Object.entries(porGrupo).map(([k, v]) => [k, Number(v.toFixed(2))])),
    faturasCartao,
    ultimosLancamentos: lancamentos
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .slice(0, 10)
      .map(l => ({ data: l.data, desc: l.desc, valor: l.valor, tipo: l.tipo, grupo: l.grupo })),
  }
}

export async function responderPergunta(texto, { lancamentos, cartoes, saldoInicial, orcamento, mesKey, hoje }) {
  const contexto = montarContexto({ lancamentos, cartoes, saldoInicial, orcamento, mesKey })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: `Você é a Tina, assistente financeira do app SECRE·TINA, respondendo pelo WhatsApp. Responda a pergunta em português, curto e direto (é chat, não um relatório) — 1 a 3 frases na maioria dos casos, use quebra de linha se listar vários itens. Use APENAS os números do JSON abaixo; nunca invente valor. Se a pergunta pedir algo que não está nos dados (ex.: um mês diferente do atual, ou algo não calculado aqui), diga que não tem esse dado agora em vez de estimar. Valores em R$, formato brasileiro (vírgula decimal).

Data de hoje: ${hoje}
Dados do mês ${mesKey}:
${JSON.stringify(contexto, null, 1)}`,
    messages: [{ role: 'user', content: texto }],
  })

  const block = response.content.find(b => b.type === 'text')
  return block ? block.text : 'Não consegui calcular isso agora.'
}
