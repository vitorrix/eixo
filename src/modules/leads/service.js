import {
  collection, doc, getDocs, query, where,
  onSnapshot, updateDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { createClienteRapido } from '../clientes/service.js'
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

export async function iniciarFollowUp(id, nextFollowUpAt) {
  return updateDoc(doc(db, COL, id), {
    status: 'em_followup',
    nextFollowUpAt,
    updatedAt: serverTimestamp(),
  })
}

// Firestore não aceita serverTimestamp() dentro de um elemento de arrayUnion
// (só no nível raiz do documento) — usa a hora do cliente aqui, não é
// crítico pra esse campo (é só um registro de conversa, não financeiro).
function notaAtual(texto) {
  const { name, email } = getCurrentProfile() || {}
  return { text: texto.trim(), author: name || email || '—', at: new Date() }
}

export async function marcarContatado(id, { nota, proximoRetorno }) {
  const patch = { updatedAt: serverTimestamp() }
  if (nota) patch.notes = arrayUnion(notaAtual(nota))
  if (proximoRetorno) { patch.status = 'em_followup'; patch.nextFollowUpAt = proximoRetorno }
  return updateDoc(doc(db, COL, id), patch)
}

export async function marcarSemResposta(id) {
  return updateDoc(doc(db, COL, id), { status: 'sem_resposta', updatedAt: serverTimestamp() })
}

export async function descartarLead(id, { discardReason, discardNote }) {
  return updateDoc(doc(db, COL, id), {
    status: 'descartado',
    discardReason,
    discardNote: discardNote || null,
    updatedAt: serverTimestamp(),
  })
}

// Acha um cliente já cadastrado com o mesmo telefone (evita duplicar quando o
// lead já é cliente antigo) — senão cria um cadastro rápido, igual ao já
// usado em outros pontos do sistema. Lead do Instagram não tem telefone (só
// o WhatsApp captura isso) — nesse caso nunca dá pra achar por telefone,
// sempre cria um cadastro novo.
export async function converterEmCliente(lead) {
  const telefoneDigits = (lead.phone || '').replace(/\D/g, '')
  const snap = telefoneDigits
    ? await getDocs(query(collection(db, 'clientes'), where('phone', '==', telefoneDigits)))
    : { empty: true, docs: [] }
  const nome = lead.name || lead.phone || 'Lead Instagram'
  const clienteId = snap.empty
    ? (await createClienteRapido(nome, lead.phone || '')).id
    : snap.docs[0].id

  await updateDoc(doc(db, COL, lead.id), {
    status: 'convertido',
    clienteId,
    updatedAt: serverTimestamp(),
  })
  return clienteId
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
