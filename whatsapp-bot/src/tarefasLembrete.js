// Lembrete de tarefa do módulo Tarefas do Eixo — mesmo padrão do aniversário
// (aniversario.js): o bot mesmo decide quando mandar, checando a cada poucos
// minutos se o prazo bateu, em vez de depender de alguém estar com o Eixo
// aberto. Uma mensagem só, no horário do prazo — sem repique se ficar
// atrasada (isso já aparece no Mural do Dashboard pra quem abrir o sistema).

// Só Vitor e Ana usam o Eixo na Baruk hoje — mesma lista fixa (uid → nome +
// telefone) do módulo Tarefas em src/modules/tarefas/service.js, duplicada
// aqui porque o bot roda num runtime separado (Admin SDK) sem import
// compartilhado com o front.
const RESPONSAVEIS = {
  'YtNG0UQEo6WAc8c75qvg1yR2NwW2': { nome: 'Vitor', telefone: '5511995844837' },
  '9tYvt0hqmsSumb0ysqLJPprmS0J3': { nome: 'Ana',   telefone: '5513997666686' },
}

// Mesmo formato cru de <input type="datetime-local"> ('YYYY-MM-DDTHH:mm'),
// pra comparar com o campo `prazo` como string — sem passar por UTC.
function nowLocalDT() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatPrazo(prazo) {
  const [data, hora] = prazo.split('T')
  const [, m, dia] = data.split('-')
  return `${dia}/${m} às ${hora}`
}

function mensagemLembrete(tarefa) {
  const linhas = [
    '📋 *Lembrete de tarefa — Eixo*',
    '',
    tarefa.titulo,
  ]
  if (tarefa.descricao) linhas.push('', tarefa.descricao)
  linhas.push('', `Prazo: ${formatPrazo(tarefa.prazo)}`)
  return linhas.join('\n')
}

export async function checkAndSendLembretesTarefas(getSock, db) {
  const sock = getSock()
  if (!sock) {
    console.error('[tarefas] sem conexão ativa com o WhatsApp — tenta de novo no próximo ciclo.')
    return
  }

  const agora = nowLocalDT()
  const snap = await db.collection('tarefas').where('lembreteEnviado', '==', false).get()
  if (snap.empty) return

  for (const doc of snap.docs) {
    const t = doc.data()
    if (t.status === 'concluida') continue
    if (!t.prazo || t.prazo > agora) continue

    try {
      const destinatarios = (t.responsaveis || []).map(uid => RESPONSAVEIS[uid]).filter(Boolean)
      if (!destinatarios.length) {
        console.log(`[tarefas] "${t.titulo}" sem responsável reconhecido — pulado.`)
        continue
      }

      const texto = mensagemLembrete(t)
      for (const { nome, telefone } of destinatarios) {
        await sock.sendMessage(`${telefone}@s.whatsapp.net`, { text: texto })
        console.log(`[tarefas] lembrete de "${t.titulo}" enviado para ${nome}.`)
      }
      await doc.ref.update({ lembreteEnviado: true })
    } catch (err) {
      console.error(`[tarefas] falha ao enviar lembrete de "${t.titulo}":`, err)
    }
  }
}
