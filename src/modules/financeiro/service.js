import {
  collection, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { proximoNumeroFinanceiro } from '../configuracoes/service.js'

const COL = 'financeiro'

// Trava de segurança pra recorrência não gerar uma quantidade absurda de
// lançamentos se alguém errar o ano da data final (5 anos de meses).
const MAX_OCORRENCIAS_RECORRENCIA = 60

export function subscribeFinanceiro(callback, onError) {
  const q = query(collection(db, COL), orderBy('criadoEm', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

function addMonths(dataISO, n) {
  const [y, m, d] = dataISO.split('-').map(Number)
  const data = new Date(y, m - 1 + n, d)
  return data.toISOString().slice(0, 10)
}

// Uma ocorrência por mês entre dataInicial e dataFinal (inclusive), todas
// marcadas com o mesmo grupoId pra dar pra reconhecer a série depois.
function gerarOcorrenciasRecorrentes(base, recorrencia) {
  const { dataInicial, dataFinal, diaDoMes } = recorrencia
  const grupoId = crypto.randomUUID()
  const ocorrencias = []
  let cursor = dataInicial
  let i = 0
  while (cursor <= dataFinal && i < MAX_OCORRENCIAS_RECORRENCIA) {
    const [y, m] = cursor.split('-')
    ocorrencias.push({
      ...base,
      dataVencimento: `${y}-${m}-${String(diaDoMes).padStart(2, '0')}`,
      liquidado:      false,
      dataLiquidacao: null,
      recorrencia:    { ...recorrencia, grupoId },
    })
    cursor = addMonths(cursor, 1)
    i++
  }
  return ocorrencias
}

// Cria um lançamento avulso (Recebimento ou Pagamento). Com recorrência ativa,
// gera uma ocorrência por mês no período em vez de um único doc — todas no
// mesmo batch, então ou grava tudo ou nada.
export async function createLancamento(data) {
  const { uid } = getCurrentProfile()

  const base = {
    tipo:            data.tipo,
    descricao:       (data.descricao || '').trim(),
    valor:           parseFloat(data.valor) || 0,
    contato:         (data.contato || '').trim(),
    categoria:       data.categoria || '',
    conta:           data.conta || '',
    formaPagamento:  data.formaPagamento || '',
    liquidado:       !!data.liquidado,
    dataVencimento:  data.dataVencimento || '',
    dataLiquidacao:  data.liquidado ? (data.dataLiquidacao || data.dataVencimento) : null,
    numeroDocumento: (data.numeroDocumento || '').trim(),
    observacoes:     (data.observacoes || '').trim(),
    parcela:         data.parcela || { numero: 1, total: 1 },
    origem:          data.origem || { tipo: 'avulso', id: null, pedidoId: null },
    recorrencia:     null,
    criadoPor:       uid,
    criadoEm:        serverTimestamp(),
  }

  const lancamentos = (data.recorrencia?.ativo && data.recorrencia.dataInicial && data.recorrencia.dataFinal)
    ? gerarOcorrenciasRecorrentes(base, data.recorrencia)
    : [base]

  const batch = writeBatch(db)
  for (const l of lancamentos) {
    const numero = await proximoNumeroFinanceiro()
    batch.set(doc(collection(db, COL)), { ...l, numero })
  }
  return batch.commit()
}

export async function updateLancamento(id, fields) {
  const patch = { ...fields }
  if (patch.valor !== undefined) patch.valor = parseFloat(patch.valor) || 0
  return updateDoc(doc(db, COL, id), patch)
}

export async function marcarLiquidado(id, liquidado) {
  return updateDoc(doc(db, COL, id), {
    liquidado,
    dataLiquidacao: liquidado ? new Date().toISOString().slice(0, 10) : null,
  })
}

export async function deleteLancamento(id) {
  return deleteDoc(doc(db, COL, id))
}
