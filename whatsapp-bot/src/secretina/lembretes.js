// Avisa no WhatsApp quando chega perto da hora de um compromisso/lembrete da
// Agenda (users/{uid}/agenda) — tanto os criados por lá (lembreteParser.js)
// quanto os criados no app. Sem fila: o bot decide sozinho comparando agora
// com o horário-gatilho do compromisso, no mesmo espírito do
// aniversario.js. Dedup por campo `avisado_whatsapp` gravado no próprio doc
// — sobrevive a restart do bot sem reenviar.
import { readFileSync } from 'fs'
import { getLembretesPendentesAviso } from './firestoreWriter.js'

const USUARIOS_PATH = new URL('../../config/secretinaUsuarios.json', import.meta.url)
const HORA_PADRAO = '08:00' // lembrete sem horário definido avisa de manhã
// Tolera até 20min de atraso (bot reconectando, tick perdido) sem virar uma
// rajada de avisos velhos quando o bot fica muito tempo fora do ar.
const JANELA_GRACA_MS = 20 * 60 * 1000

const TIPO_ICONE = { Compromisso: '🗓️', Saude: '🏥', Pagamento: '💰' }
const PRIOR_ICONE = { alta: '🔴', media: '🟡', baixa: '🟢' }
const PRIOR_LABEL = { alta: 'alta', media: 'média', baixa: 'baixa' }

function carregarUsuarios() {
  return JSON.parse(readFileSync(USUARIOS_PATH))
}

function hojeLocalISO(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Horário em que o compromisso deve disparar o aviso: o alerta explícito
// (definido no app, campos alerta_data/alerta_hora) tem prioridade sobre a
// hora do próprio compromisso — é o "me avisa antes" que a pessoa escolheu
// por lá. Sem alerta e sem hora nenhuma, avisa de manhã no dia.
function horaGatilho(a) {
  if (a.alerta_data && a.alerta_hora) return new Date(`${a.alerta_data}T${a.alerta_hora}:00`)
  if (a.hora) return new Date(`${a.data}T${a.hora}:00`)
  return new Date(`${a.data}T${HORA_PADRAO}:00`)
}

function quandoTxt(a) {
  const horaTxt = a.hora ? ` às ${a.hora}` : ''
  if (a.data === hojeLocalISO()) return `Hoje${horaTxt}`
  if (a.data === hojeLocalISO(new Date(Date.now() + 24 * 60 * 60 * 1000))) return `Amanhã${horaTxt}`
  const [, m, d] = a.data.split('-')
  return `${d}/${m}${horaTxt}`
}

function montarMensagem(a) {
  const icone = TIPO_ICONE[a.tipo] || '🗓️'
  const prior = PRIOR_ICONE[a.prioridade] || '🟡'
  let msg = `🔔 *${a.titulo}*\n${icone} ${a.tipo || 'Compromisso'} · ${prior} prioridade ${PRIOR_LABEL[a.prioridade] || a.prioridade}\n📅 ${quandoTxt(a)}`
  if (a.obs) msg += `\n📝 ${a.obs}`
  return msg
}

export async function checkAndSendLembretes(getSock) {
  const sock = getSock()
  if (!sock) {
    console.error('[lembretes] sem conexão ativa com o WhatsApp — tenta de novo no próximo ciclo.')
    return
  }

  const usuarios = carregarUsuarios() // chave (@lid) -> uid
  const agora = Date.now()

  for (const [chave, uid] of Object.entries(usuarios)) {
    try {
      const pendentes = await getLembretesPendentesAviso(uid)
      for (const a of pendentes) {
        const gatilho = horaGatilho(a).getTime()
        // Ainda não chegou a hora, ou já passou demais (tolerância da janela
        // de graça) — nesse segundo caso não marca como avisado: se a pessoa
        // quiser, um lembrete "perdido" fica visível na Agenda do app mesmo
        // sem o aviso por WhatsApp.
        if (gatilho > agora || agora - gatilho > JANELA_GRACA_MS) continue

        const jid = `${chave}@lid`
        await sock.sendMessage(jid, { text: montarMensagem(a) })
        await a.ref.update({ avisado_whatsapp: true })
        console.log(`[lembretes] avisado: "${a.titulo}" (${uid})`)
      }
    } catch (err) {
      console.error(`[lembretes] erro ao checar lembretes de ${uid}:`, err)
    }
  }
}
