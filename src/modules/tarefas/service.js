import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'

const COL = 'tarefas'

// Só Vitor e Ana usam o Eixo na Baruk hoje — lista fixa em vez de consultar
// /users (que também tem outras contas, ex: funcionária de outra loja).
// `cor` identifica cada um visualmente (avatar do widget do Dashboard) —
// verde-petróleo (cor da marca) pro Vitor, âmbar (mesmo tom já usado em
// aniversário) pra Ana, só pra não repetir a mesma cor pros dois.
export const RESPONSAVEIS = [
  { uid: 'YtNG0UQEo6WAc8c75qvg1yR2NwW2', nome: 'Vitor', cor: '#123C43' },
  { uid: '9tYvt0hqmsSumb0ysqLJPprmS0J3', nome: 'Ana',   cor: '#f59e0b' },
]

export function nomeResponsavel(uid) {
  return RESPONSAVEIS.find(r => r.uid === uid)?.nome || '—'
}

export function responsavel(uid) {
  return RESPONSAVEIS.find(r => r.uid === uid) || null
}

export function nomesResponsaveis(uids = []) {
  return uids.map(nomeResponsavel).join(' + ') || '—'
}

// Sem orderBy — tarefa sem prazo (nice-to-have sem data marcada) não pode
// sumir da lista, e um doc faltando o campo do orderBy é excluído pelo
// Firestore. Ordenação fica por conta do list.js, no cliente.
export function subscribeTarefas(callback, onError) {
  return onSnapshot(collection(db, COL), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }, onError)
}

export async function createTarefa(data) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, COL), {
    titulo:          (data.titulo || '').trim(),
    descricao:       (data.descricao || '').trim(),
    responsaveis:    data.responsaveis || [],
    prioridade:      data.prioridade || 'media',
    status:          'pendente',
    prazo:           data.prazo || '',
    lembreteEnviado: false,
    criadoPor:       uid,
    criadoEm:        serverTimestamp(),
    atualizadoEm:    serverTimestamp(),
    concluidaEm:     null,
  })
}

export async function updateTarefa(id, fields) {
  const patch = { ...fields, atualizadoEm: serverTimestamp() }
  // Prazo mudou → reabre a janela do lembrete pro bot mandar de novo no horário novo.
  if ('prazo' in fields) patch.lembreteEnviado = false
  return updateDoc(doc(db, COL, id), patch)
}

export async function marcarStatus(id, status) {
  return updateDoc(doc(db, COL, id), {
    status,
    atualizadoEm: serverTimestamp(),
    concluidaEm: status === 'concluida' ? serverTimestamp() : null,
  })
}

export async function deleteTarefa(id) {
  return deleteDoc(doc(db, COL, id))
}
