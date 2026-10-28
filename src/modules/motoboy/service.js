import {
  collection, doc, getDoc, getDocs, onSnapshot, query, orderBy, where,
  writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { proximoNumeroFinanceiro } from '../configuracoes/service.js'
import { isoLocal } from '../../shared/utils/periodo.js'

const COL = 'acertosMotoboy'

export function subscribeAcertos(callback, onError) {
  const q = query(collection(db, COL), orderBy('data', 'desc'))
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError
  )
}

const arred = n => Math.round(n * 100) / 100

// Valor do km de um trecho: o dele (roteiro pago por valor diferente do padrão)
// ou, sem valor próprio, o padrão do roteiro.
export function taxaDoTrecho(t, valorKmPadrao) {
  const v = parseFloat(t.valorKm)
  return Number.isFinite(v) ? v : (parseFloat(valorKmPadrao) || 0)
}

// Totais do acerto: soma de km x valor do km de cada trecho + extras (ex:
// acessório que o motoboy pagou). Usado pelo formulário (ao vivo) e na hora de gravar.
export function calcularAcerto({ trechos = [], extras = [], valorKm = 0 }) {
  const totalKm = arred(trechos.reduce((s, t) => s + (parseFloat(t.km) || 0), 0))
  const valorRodado = arred(trechos.reduce((s, t) => s + (parseFloat(t.km) || 0) * taxaDoTrecho(t, valorKm), 0))
  const totalExtras = arred(extras.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0))
  return { totalKm, valorRodado, totalExtras, total: arred(valorRodado + totalExtras) }
}

// Grava o acerto e, junto, 1 Pagamento no Financeiro (categoria de frete/
// motoboy) vinculado a ele — mesmo padrão dos lançamentos gerados por Pedido:
// só pode ser excluído lá, e excluir o acerto apaga o lançamento junto.
function normalizarAcerto(data) {
  const trechos = data.trechos.map(t => ({
    origem: (t.origem || '').trim(), destino: (t.destino || '').trim(),
    cliente: (t.cliente || '').trim(), item: (t.item || '').trim(),
    descricao: (t.descricao || '').trim(), km: parseFloat(t.km) || 0, pedidoId: t.pedidoId || null,
    valorKm: taxaDoTrecho(t, data.valorKm),
  }))
  const extras = data.extras
    .map(e => ({ descricao: (e.descricao || '').trim(), valor: parseFloat(e.valor) || 0 }))
    .filter(e => e.descricao || e.valor)
  const valorKm = parseFloat(data.valorKm) || 0
  const variado = trechos.some(t => t.valorKm !== valorKm)
  const totais = calcularAcerto({ trechos, extras, valorKm })
  const motoboy = (data.motoboy || '').trim()
  const [y, m, d] = data.data.split('-')
  return {
    trechos, extras, valorKm, totais, motoboy,
    descricaoLanc: `Motoboy ${motoboy} — ${d}/${m}/${y}`.replace('Motoboy  —', 'Motoboy —'),
    obsLanc: `${totais.totalKm} km ${variado ? '(valor por km variado)' : `x R$ ${valorKm.toFixed(2)}`}${totais.totalExtras ? ` + extras R$ ${totais.totalExtras.toFixed(2)}` : ''}`,
  }
}

// Grava o acerto e, junto, 1 Pagamento no Financeiro (categoria de frete/
// motoboy) vinculado a ele — mesmo padrão dos lançamentos gerados por Pedido:
// só pode ser excluído lá, e excluir o acerto apaga o lançamento junto.
export async function createAcerto(data, { liquidado, conta, categoria }) {
  const { uid } = getCurrentProfile()
  const { trechos, extras, valorKm, totais, motoboy, descricaoLanc, obsLanc } = normalizarAcerto(data)

  const acertoRef = doc(collection(db, COL))
  const batch = writeBatch(db)
  const numero = await proximoNumeroFinanceiro()

  batch.set(acertoRef, {
    data: data.data, motoboy, motoboyId: data.motoboyId || null, valorKm,
    trechos, extras, ...totais,
    lancamentoNumero: numero,
    criadoPor: uid, criadoEm: serverTimestamp(),
  })
  batch.set(doc(collection(db, 'financeiro')), {
    numero, tipo: 'pagar',
    descricao:       descricaoLanc,
    valor:           totais.total,
    contato:         motoboy,
    contatoId:       data.motoboyId || null,
    contatoTipo:     data.motoboyId ? 'fornecedor' : null,
    categoria:       categoria || '',
    conta:           conta || '',
    formaPagamento:  '',
    liquidado:       !!liquidado,
    dataVencimento:  data.data,
    dataLiquidacao:  liquidado ? data.data : null,
    numeroDocumento: '',
    observacoes:     obsLanc,
    parcela:         { numero: 1, total: 1 },
    origem:          { tipo: 'motoboy', id: acertoRef.id, pedidoId: null },
    recorrencia:     null,
    criadoPor:       uid,
    criadoEm:        serverTimestamp(),
  })
  return batch.commit()
}

// Pagamento do Financeiro ligado ao acerto (null se alguém já apagou).
export async function getLancamentoDoAcerto(id) {
  const snap = await getDocs(query(
    collection(db, 'financeiro'),
    where('origem.tipo', '==', 'motoboy'),
    where('origem.id', '==', id)
  ))
  const d = snap.docs[0]
  return d ? { id: d.id, ...d.data() } : null
}

// Edita o roteiro e propaga pro Pagamento no Financeiro (valor, data, motoboy,
// categoria, conta e situação paga/pendente). Se o lançamento sumiu, recria.
export async function updateAcerto(id, data, { liquidado, conta, categoria }, lancamentoAtual) {
  const { uid } = getCurrentProfile()
  const { trechos, extras, valorKm, totais, motoboy, descricaoLanc, obsLanc } = normalizarAcerto(data)
  const batch = writeBatch(db)

  const campos = {
    descricao:      descricaoLanc,
    valor:          totais.total,
    contato:        motoboy,
    contatoId:      data.motoboyId || null,
    contatoTipo:    data.motoboyId ? 'fornecedor' : null,
    categoria:      categoria || '',
    conta:          conta || '',
    liquidado:      !!liquidado,
    dataVencimento: data.data,
    // já pago antes: mantém a data em que foi pago; recém-marcado como pago: hoje
    dataLiquidacao: liquidado ? (lancamentoAtual?.liquidado && lancamentoAtual.dataLiquidacao) || isoLocal(new Date()) : null,
    observacoes:    obsLanc,
  }
  let numero = lancamentoAtual?.numero ?? null
  if (lancamentoAtual) {
    batch.update(doc(db, 'financeiro', lancamentoAtual.id), campos)
  } else {
    numero = await proximoNumeroFinanceiro()
    batch.set(doc(collection(db, 'financeiro')), {
      numero, tipo: 'pagar', ...campos,
      formaPagamento: '', numeroDocumento: '', parcela: { numero: 1, total: 1 },
      origem: { tipo: 'motoboy', id, pedidoId: null }, recorrencia: null,
      criadoPor: uid, criadoEm: serverTimestamp(),
    })
  }
  batch.update(doc(db, COL, id), {
    data: data.data, motoboy, motoboyId: data.motoboyId || null, valorKm,
    trechos, extras, ...totais,
    lancamentoNumero: numero,
    atualizadoPor: uid, atualizadoEm: serverTimestamp(),
  })
  return batch.commit()
}

export async function deleteAcerto(id) {
  const lancSnap = await getDocs(query(
    collection(db, 'financeiro'),
    where('origem.tipo', '==', 'motoboy'),
    where('origem.id', '==', id)
  ))
  const batch = writeBatch(db)
  lancSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, COL, id))
  return batch.commit()
}

function enderecoTexto(addr) {
  if (!addr) return ''
  const { logradouro, numero, complemento, bairro, cidade, estado } = addr
  return [
    [logradouro, numero].filter(Boolean).join(', '),
    complemento, bairro,
    [cidade, estado].filter(Boolean).join(' - '),
  ].filter(Boolean).join(', ')
}

// Entregas de motoboy já concluídas num dia (venda com dataEntrega naquele
// dia), viradas em trechos "retirada → entrega" a partir do Roteiro salvo no
// pedido. O km fica em branco: quem mede é o Maps. Loja vira endereço quando o
// fornecedor está cadastrado (nome - box); senão vai o próprio nome da loja,
// que o Maps também entende.
export async function trechosDasEntregasDoDia(dataISO, fornecedores = []) {
  const snap = await getDocs(query(collection(db, 'vendas'), where('statusEntrega', '==', 'entregue')))
  const doDia = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => v.pedidoId && v.dataEntrega?.toDate && isoLocal(v.dataEntrega.toDate()) === dataISO)

  const enderecoLoja = loja => {
    const f = fornecedores.find(f => (f.box ? `${f.name} - ${f.box}` : f.name) === loja)
    return enderecoTexto(f?.address) || loja
  }

  const trechos = []
  let semRoteiro = 0
  for (const venda of doDia) {
    const pSnap = await getDoc(doc(db, 'pedidos', venda.pedidoId))
    if (!pSnap.exists()) continue
    const pedido = { id: pSnap.id, ...pSnap.data() }
    if (pedido.logistica?.tipo !== 'motoboy') continue

    const roteiro = pedido.logistica?.roteiro
    let retiradas = [], entrega = {}
    if (roteiro && !Array.isArray(roteiro) && roteiro.retiradas) {
      retiradas = roteiro.retiradas; entrega = roteiro.entrega || {}
    } else if (Array.isArray(roteiro) && roteiro.length) {
      retiradas = roteiro.map(p => ({ item: p.retirada?.item || '', loja: p.retirada?.loja || '' }))
      entrega = { endereco: roteiro[0]?.entrega?.endereco || '', cliente: pedido.cliente }
    }
    if (!retiradas.length) { semRoteiro++; continue }

    retiradas.forEach((r, i) => {
      trechos.push({
        origem:   r.loja ? enderecoLoja(r.loja) : '',
        destino:  entrega.endereco || '',
        cliente:  pedido.cliente || entrega.cliente || '',
        item:     r.item || '',
        descricao: `${pedido.cliente || entrega.cliente || ''}${r.item ? ' — ' + r.item : ''}`,
        km: '',
        pedidoId: `${pedido.id}#${i}`,
      })
    })
  }
  return { trechos, semRoteiro, entregas: doDia.length }
}
