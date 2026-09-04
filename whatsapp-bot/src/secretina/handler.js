// Lançamento de despesas e perguntas sobre finanças do secretina via DM no
// WhatsApp. Roteado a partir de handleMessages() no index.js quando a
// mensagem não é de grupo. Isolado do fluxo de fornecedores/ofertas — só
// compartilha a conexão (sock) do bot.
//
// Quando falta um dado que a IA não pode adivinhar com segurança (forma de
// pagamento, ou qual cartão), o bot pergunta de volta em vez de chutar. O
// estado da pergunta pendente fica em memória (Map por jid) — não precisa
// sobreviver a um restart do bot, e evita gravar lançamento incompleto.
import { readFileSync } from 'fs'
import { parseLancamentoWithAI } from './aiParser.js'
import { classificarIntencao } from './intentClassifier.js'
import { responderPergunta } from './perguntas.js'
import {
  getGruposEItens, getCartoes, salvarLancamento,
  getLancamentosDoMes, getSaldoInicial, getOrcamento,
  getGastoCategoria, getFaturaKey,
} from './firestoreWriter.js'

const USUARIOS_PATH = new URL('../../config/secretinaUsuarios.json', import.meta.url)
const FORMAS = ['pix', 'debito', 'dinheiro', 'cartao', 'ticket']
const FORMA_LABEL = { pix: 'Pix / Transferência', debito: 'Débito', dinheiro: 'Dinheiro', cartao: 'Cartão de crédito', ticket: 'Ticket / Vale' }
const FORMA_ICONE = { pix: '🔁', debito: '🏧', dinheiro: '💵', cartao: '💳', ticket: '🎫' }
const PENDENTE_TTL_MS = 10 * 60 * 1000
const TENTATIVAS_MAX = 3

// Todo texto que o bot manda leva essa marca — como ele roda como
// dispositivo vinculado à própria conta (sem número separado), toda mensagem
// que ele manda volta pro mesmo chat como "recebida" de novo. A marca é o que
// permite reconhecer e ignorar o próprio eco, em vez de reprocessar a
// resposta como se fosse uma mensagem nova da pessoa.
const BOT_TAG = '🤖 '

const pendentes = new Map() // jid -> { uid, telefone, dados, cartoes, campo, tentativas, criadoEm }

function carregarUsuarios() {
  return JSON.parse(readFileSync(USUARIOS_PATH))
}

// JIDs de DM vêm como "5511995844837@s.whatsapp.net" (ou "...@lid" nesta
// conta), às vezes com sufixo de device (":12") em contas multi-aparelho.
function telefoneFromJid(jid) {
  return jid.split('@')[0].split(':')[0]
}

// Usado pelo index.js pra decidir se uma DM é do secretina (Vitor/Ana
// perguntando/lançando gasto) ou de outra pessoa — nesse segundo caso vira
// candidato a lead (ver leads.js). Não muda nada aqui, só expõe a mesma
// checagem que já existe dentro de handleSecretinaMessage.
export function ehUsuarioSecretina(jid) {
  return !!carregarUsuarios()[telefoneFromJid(jid)]
}

function hojeLocalISO(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function mesKeyDe(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtR(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizar(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

async function enviar(sock, jid, texto) {
  await sock.sendMessage(jid, { text: BOT_TAG + texto })
}

function resolveForma(texto) {
  const t = normalizar(texto)
  const num = parseInt(t, 10)
  if (num >= 1 && num <= FORMAS.length) return FORMAS[num - 1]
  if (t.includes('pix') || t.includes('transfer')) return 'pix'
  if (t.includes('debit')) return 'debito'
  if (t.includes('dinheiro') || t.includes('especie')) return 'dinheiro'
  if (t.includes('cart') || t.includes('credit')) return 'cartao'
  if (t.includes('ticket') || t.includes('vale')) return 'ticket'
  return null
}

function resolveCartao(texto, cartoes) {
  const t = normalizar(texto)
  const num = parseInt(t, 10)
  if (num >= 1 && num <= cartoes.length) return cartoes[num - 1].nome
  const match = cartoes.find(c => {
    const n = normalizar(c.nome)
    return n.includes(t) || t.includes(n)
  })
  return match ? match.nome : null
}

function textoPerguntaForma() {
  return 'Pagou como?\n' + FORMAS.map((f, i) => `${i + 1}) ${FORMA_LABEL[f]}`).join('\n') + '\nResponde com o número ou escreve.'
}

function textoPerguntaCartao(cartoes) {
  return 'Qual cartão?\n' + cartoes.map((c, i) => `${i + 1}) ${c.nome}`).join('\n') + '\nResponde com o número ou escreve.'
}

// Barrinha de progresso de 10 blocos coloridos — dá pra "ver" o quanto falta
// numa olhada só, sem precisar fazer conta de cabeça lendo dois valores.
function barraProgresso(pct, cor) {
  const blocos = 10
  const cheios = Math.max(0, Math.min(blocos, Math.round((pct / 100) * blocos)))
  return cor.repeat(cheios) + '⬜'.repeat(blocos - cheios)
}

// Bloco extra na confirmação mostrando quanto do orçamento daquele grupo/item
// já foi usado esse mês (incluindo o lançamento que acabou de entrar). Vazio
// se a pessoa não tem orçamento definido pra essa combinação — não faz
// sentido mostrar barra de "R$X de R$0,00". Três tons: verde (tranquilo),
// amarelo (>=80%, é bom já saber) e vermelho (estourou).
function linhaOrcamento(item, orcado, gasto) {
  if (orcado <= 0) return ''
  const pct = Math.round((gasto / orcado) * 100)
  const restante = orcado - gasto

  if (gasto > orcado) {
    return `\n\n${barraProgresso(100, '🟥')}\n🔴 *${item}* estourou o orçamento\n${fmtR(gasto)} usados de ${fmtR(orcado)} · excedeu em ${fmtR(gasto - orcado)}`
  }
  const cor = pct >= 80 ? '🟨' : '🟩'
  const aviso = pct >= 80 ? '🟡' : '📊'
  return `\n\n${barraProgresso(pct, cor)}\n${aviso} *${item}*: ${pct}% do orçamento usado\nRestam ${fmtR(restante)} de ${fmtR(orcado)}`
}

async function finalizarLancamento(sock, jid, telefone, uid, dados, grupos, cartoes) {
  await salvarLancamento(uid, dados)

  if (dados.tipo === 'entrada') {
    await enviar(sock, jid, `✅ *Lançado:* ${dados.desc} — *${fmtR(dados.valor)}*\n💰 Entrada · ${dados.categoria}`)
    console.log(`[secretina] ${telefone}: entrada ${dados.desc} — ${fmtR(dados.valor)} (${dados.categoria})`)
    return
  }

  const parcelasTxt = dados.parcelas > 1 ? ` em ${dados.parcelas}x` : ''
  const formaTxt = dados.forma === 'cartao' ? `${dados.cartao_nome}${parcelasTxt}` : FORMA_LABEL[dados.forma] || dados.forma
  const icone = FORMA_ICONE[dados.forma] || '💳'
  let msg = `✅ *Lançado:* ${dados.desc} — *${fmtR(dados.valor)}*\n${icone} ${formaTxt}`

  if (dados.grupo && dados.item && grupos && cartoes) {
    try {
      const g = grupos.find(x => x.nome === dados.grupo)
      const chave = g ? `${g.id}|||${dados.item}` : null
      const orcamento = chave ? await getOrcamento(uid) : null
      const orcado = orcamento ? parseFloat(orcamento[chave]) || 0 : 0
      if (orcado > 0) {
        const mesKey = dados.forma === 'cartao' && dados.cartao_nome
          ? getFaturaKey(dados.data, (cartoes.find(c => c.nome === dados.cartao_nome)?.fechamento) || 1)
          : dados.data.slice(0, 7)
        const gasto = await getGastoCategoria(uid, dados.grupo, dados.item, mesKey, cartoes)
        msg += linhaOrcamento(dados.item, orcado, gasto)
      }
    } catch (err) {
      console.error('[secretina] Erro ao calcular orçamento (segue sem essa linha):', err)
    }
  }

  await enviar(sock, jid, msg)
  console.log(`[secretina] ${telefone}: ${dados.desc} — ${fmtR(dados.valor)} (${formaTxt})`)
}

// Depois de resolver a forma (seja de uma mensagem nova ou de uma resposta a
// pergunta pendente), decide se falta perguntar o cartão ou se já dá pra
// gravar.
async function prosseguirComForma(sock, jid, telefone, uid, dados, cartoes, grupos) {
  if (dados.forma === 'cartao' && !cartoes.find(c => c.nome === dados.cartao_nome)) {
    if (cartoes.length === 0) {
      await enviar(sock, jid, 'Não tem cartão cadastrado no app — lança lá primeiro ou escolhe outra forma de pagamento.')
      pendentes.delete(jid)
      return
    }
    pendentes.set(jid, { uid, telefone, dados, cartoes, grupos, campo: 'cartao_nome', tentativas: 0, criadoEm: Date.now() })
    await enviar(sock, jid, textoPerguntaCartao(cartoes))
    return
  }
  pendentes.delete(jid)
  await finalizarLancamento(sock, jid, telefone, uid, dados, grupos, cartoes)
}

async function handlePendente(sock, jid, texto, pendente) {
  if (Date.now() - pendente.criadoEm > PENDENTE_TTL_MS) {
    pendentes.delete(jid)
    return false // expirou — trata como mensagem nova
  }

  if (pendente.campo === 'forma') {
    const forma = resolveForma(texto)
    if (!forma) {
      pendente.tentativas++
      if (pendente.tentativas >= TENTATIVAS_MAX) {
        pendentes.delete(jid)
        await enviar(sock, jid, 'Não entendi. Manda a mensagem completa de novo quando puder.')
        return true
      }
      await enviar(sock, jid, 'Não entendi. ' + textoPerguntaForma())
      return true
    }
    pendente.dados.forma = forma
    await prosseguirComForma(sock, jid, pendente.telefone, pendente.uid, pendente.dados, pendente.cartoes, pendente.grupos)
    return true
  }

  if (pendente.campo === 'cartao_nome') {
    const cartaoNome = resolveCartao(texto, pendente.cartoes)
    if (!cartaoNome) {
      pendente.tentativas++
      if (pendente.tentativas >= TENTATIVAS_MAX) {
        pendentes.delete(jid)
        await enviar(sock, jid, 'Não entendi. Manda a mensagem completa de novo quando puder.')
        return true
      }
      await enviar(sock, jid, 'Não entendi. ' + textoPerguntaCartao(pendente.cartoes))
      return true
    }
    pendente.dados.cartao_nome = cartaoNome
    pendentes.delete(jid)
    await finalizarLancamento(sock, jid, pendente.telefone, pendente.uid, pendente.dados, pendente.grupos, pendente.cartoes)
    return true
  }

  pendentes.delete(jid)
  return false
}

async function handlePergunta(sock, jid, telefone, uid, texto) {
  const hoje = hojeLocalISO()
  const mesKey = mesKeyDe()
  const [lancamentos, cartoes, saldoInicial, orcamento] = await Promise.all([
    getLancamentosDoMes(uid, mesKey),
    getCartoes(uid),
    getSaldoInicial(uid),
    getOrcamento(uid),
  ])
  const resposta = await responderPergunta(texto, { lancamentos, cartoes, saldoInicial, orcamento, mesKey, hoje })
  await enviar(sock, jid, resposta)
  console.log(`[secretina] ${telefone} perguntou: "${texto}"`)
}

export async function handleSecretinaMessage(sock, jid, texto) {
  if (texto.startsWith(BOT_TAG)) return // eco da própria resposta do bot

  const telefone = telefoneFromJid(jid)
  const usuarios = carregarUsuarios()
  const uid = usuarios[telefone]
  if (!uid) return // remetente não mapeado — ignora silenciosamente, não é chat do secretina

  try {
    const pendente = pendentes.get(jid)
    if (pendente) {
      const tratado = await handlePendente(sock, jid, texto, pendente)
      if (tratado) return
    }

    const intencao = await classificarIntencao(texto)

    if (intencao === 'pergunta') {
      await handlePergunta(sock, jid, telefone, uid, texto)
      return
    }

    if (intencao === 'outro') {
      await enviar(sock, jid, 'Não consegui entender como um gasto ou uma pergunta. Tenta reformular?')
      return
    }

    const [grupos, cartoes] = await Promise.all([getGruposEItens(uid), getCartoes(uid)])
    const resultado = await parseLancamentoWithAI(texto, { grupos, cartoes, hoje: hojeLocalISO() })

    if (!resultado.valido) {
      await enviar(sock, jid, `Não consegui entender como um lançamento. ${resultado.motivo || 'Tenta reformular?'}`)
      return
    }

    if (resultado.tipo === 'entrada') {
      await finalizarLancamento(sock, jid, telefone, uid, resultado, grupos, cartoes)
      return
    }

    if (!resultado.forma) {
      pendentes.set(jid, { uid, telefone, dados: resultado, cartoes, grupos, campo: 'forma', tentativas: 0, criadoEm: Date.now() })
      await enviar(sock, jid, textoPerguntaForma())
      return
    }

    await prosseguirComForma(sock, jid, telefone, uid, resultado, cartoes, grupos)
  } catch (err) {
    console.error('[secretina] Erro ao processar mensagem:', err)
    pendentes.delete(jid)
    await enviar(sock, jid, 'Deu erro ao processar. Tenta de novo em instantes?').catch(() => {})
  }
}
