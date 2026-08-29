import {
  collection, doc, getDocs, query, where,
  onSnapshot, updateDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { urgenciaFollowUp } from './constants.js'

const COL = 'leads'

// Coleção pequena (leads de tráfego pago de uma loja só) — um listener só,
// sem where/orderBy, e cada tela filtra no cliente. Mesmo padrão de
// subscribeTarefas: doc sem o campo do orderBy não pode sumir da lista.
export function subscribeLeads(callback, onError) {
  return onSnapshot(collection(db, COL), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, onError)
}

// O nome que chega do WhatsApp (pushName) às vezes não vem, ou vem errado —
// clicar no nome do card no quadro chama isso pra corrigir/completar.
export async function renomearLead(id, nome) {
  return updateDoc(doc(db, COL, id), { name: nome.trim() || null, updatedAt: serverTimestamp() })
}

// "Iniciar" (de Novo) ou "Reagendar" (de Sem Resposta) — os dois passam por
// abrirFollowUpFormModal (followUpForm.js) e representam um contato de
// verdade acontecendo agora, por isso já gravam a nota e o nível de
// interesse junto (contarTentativas em constants.js conta com isso).
export async function iniciarFollowUp(id, { nextFollowUpAt, nota, interesse }) {
  const patch = {
    status: 'em_followup',
    nextFollowUpAt,
    updatedAt: serverTimestamp(),
  }
  if (nota) patch.notes = arrayUnion(notaAtual(nota))
  if (interesse !== undefined) patch.interesse = interesse
  return updateDoc(doc(db, COL, id), patch)
}

// Firestore não aceita serverTimestamp() dentro de um elemento de arrayUnion
// (só no nível raiz do documento) — usa a hora do cliente aqui, não é
// crítico pra esse campo (é só um registro de conversa, não financeiro).
function notaAtual(texto) {
  const { name, email } = getCurrentProfile() || {}
  return { text: texto.trim(), author: name || email || '—', at: new Date() }
}

export async function marcarContatado(id, { nota, proximoRetorno, interesse }) {
  const patch = { updatedAt: serverTimestamp() }
  if (nota) patch.notes = arrayUnion(notaAtual(nota))
  if (proximoRetorno) { patch.status = 'em_followup'; patch.nextFollowUpAt = proximoRetorno }
  if (interesse !== undefined) patch.interesse = interesse
  return updateDoc(doc(db, COL, id), patch)
}

export async function marcarSemResposta(id) {
  return updateDoc(doc(db, COL, id), { status: 'sem_resposta', updatedAt: serverTimestamp() })
}

// "Não vale a pena registrar em lugar nenhum" (mensagem vazia, teste,
// engano) — diferente de descartarLead: não pede motivo, não aparece no
// Histórico nem em coluna nenhuma do quadro. status:'removido' não consta
// em COLUNAS nem em STATUS_HISTORICO (historico.js), então já some sozinho
// das duas telas sem precisar de filtro extra. Mantém o doc em vez de
// apagar de verdade — mesma convenção do resto do Eixo (nunca deleta,
// só marca fora de uso) — mas nunca aparece pra ninguém de novo.
export async function removerLead(id) {
  return updateDoc(doc(db, COL, id), { status: 'removido', updatedAt: serverTimestamp() })
}

// Sinal de intenção de compra mais forte que existe — hoje só é marcado à
// mão pela equipe (ver TODOs em whatsapp-bot/src/leads.js e
// functions/instagramLeads.js pra quando a detecção automática existir).
export async function marcarChamadaPerdida(id, tipo = null) {
  return updateDoc(doc(db, COL, id), {
    missedCallAt: serverTimestamp(),
    missedCallTipo: tipo,
    updatedAt: serverTimestamp(),
  })
}

export async function desmarcarChamadaPerdida(id) {
  return updateDoc(doc(db, COL, id), { missedCallAt: null, missedCallTipo: null, updatedAt: serverTimestamp() })
}

export async function descartarLead(id, { discardReason, discardNote }) {
  return updateDoc(doc(db, COL, id), {
    status: 'descartado',
    discardReason,
    discardNote: discardNote || null,
    updatedAt: serverTimestamp(),
  })
}

// Arrastar pra Convertido = venda concretizada, mas nem sempre precisa virar
// (ou revirar) um cadastro de Cliente — pode ser alguém que já é cliente, ou
// um contato que a loja não quer registrar. Ver perguntarConversaoCliente em
// board.js pro fluxo de decisão (Sim abre o cadastro, Não só marca aqui).
export async function marcarConvertidoSemCliente(id) {
  return updateDoc(doc(db, COL, id), { status: 'convertido', updatedAt: serverTimestamp() })
}

// Chamado depois que o form de Cliente salva com sucesso (novo cadastro ou
// edição de um já existente) — vincula o lead ao cliente e fecha o ciclo.
export async function vincularClienteConvertido(id, clienteId) {
  return updateDoc(doc(db, COL, id), { status: 'convertido', clienteId, updatedAt: serverTimestamp() })
}

// Usado só pelo badge do menu lateral — busca pontual (não é onSnapshot) pra
// não abrir um listener novo do Firestore a cada navegação de página, já que
// o layout principal é remontado em toda troca de rota.
export async function contarLeadsUrgentes() {
  const snap = await getDocs(query(collection(db, COL), where('status', '==', 'em_followup')))
  let count = 0
  snap.docs.forEach(d => {
    const nivel = urgenciaFollowUp(d.data().nextFollowUpAt)
    if (nivel === 'atrasado' || nivel === 'hoje') count++
  })
  return count
}
