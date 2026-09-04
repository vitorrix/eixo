// Segunda app do firebase-admin, apontando pro projeto secretina-1d89a — app
// nomeada pra não colidir com a instância default do eixo (../firestoreWriter.js),
// que já chama initializeApp() sem nome pro projeto eixo-ac8e0.
import { readFileSync } from 'fs'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const APP_NAME = 'secretina'

const serviceAccount = JSON.parse(
  readFileSync(new URL('../../secretinaServiceAccountKey.json', import.meta.url))
)

const app = getApps().find(a => a.name === APP_NAME)
  || initializeApp({ credential: cert(serviceAccount) }, APP_NAME)

const db = getFirestore(app)

export async function getGruposEItens(uid) {
  const snap = await db.collection('users').doc(uid).collection('config').doc('grupos').get()
  return snap.exists ? (snap.data().grupos || []) : []
}

export async function getCartoes(uid) {
  const snap = await db.collection('users').doc(uid).collection('config').doc('cartoes').get()
  return snap.exists ? (snap.data().cartoes || []) : []
}

export async function getSaldoInicial(uid) {
  const snap = await db.collection('users').doc(uid).collection('config').doc('saldoInicial').get()
  return snap.exists ? (snap.data() || {}) : {}
}

export async function getOrcamento(uid) {
  const snap = await db.collection('users').doc(uid).collection('config').doc('orcamento').get()
  return snap.exists ? (snap.data().orcamento || {}) : {}
}

// Busca por prefixo de string em vez de range >=/<=: mais simples e cobre o
// mês inteiro sem se preocupar com "31" não existir em todo mês.
export async function getLancamentosDoMes(uid, mesKey) {
  const snap = await db.collection('users').doc(uid).collection('lancamentos').get()
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(l => (l.data || '').startsWith(mesKey))
}

// getFaturaKey: mesma lógica de secretina-dashboard.html — dado a data do
// lançamento e o dia de fechamento do cartão, retorna a chave "YYYY-MM" da
// fatura em que ele cai.
export function getFaturaKey(dataStr, fechamento) {
  if (!dataStr) return ''
  const [y, m, d] = dataStr.split('-').map(Number)
  if (d > fechamento) {
    const dt = new Date(y, m, 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

// Gasto do mês numa combinação grupo+item, mesma lógica de lancMesFatura
// (secretina-dashboard.html): cartão conta pela fatura (getFaturaKey),
// débito/pix/dinheiro contam pela data da compra direto.
export async function getGastoCategoria(uid, grupo, item, mesKey, cartoes) {
  const snap = await db.collection('users').doc(uid).collection('lancamentos')
    .where('tipo', '==', 'saida')
    .where('grupo', '==', grupo)
    .where('item', '==', item)
    .get()

  return snap.docs.reduce((total, doc) => {
    const l = doc.data()
    if (!l.data) return total
    let pertenceAoMes
    if (l.forma === 'cartao' && l.cartao_nome) {
      const c = cartoes.find(x => x.nome === l.cartao_nome)
      const fechamento = c ? (c.fechamento || 1) : 1
      pertenceAoMes = getFaturaKey(l.data, fechamento) === mesKey
    } else {
      pertenceAoMes = l.data.startsWith(mesKey)
    }
    return pertenceAoMes ? total + (parseFloat(l.valor) || 0) : total
  }, 0)
}

// Replica _saveLancamento (secretina-dashboard.html) — mesmo formato de
// campos e mesma lógica de parcelamento (uma parcela = um doc, data avançando
// mês a mês sem vazar pro mês seguinte em dias > 28).
export async function salvarLancamento(uid, dados) {
  const nParcelas = parseInt(dados.parcelas) || 1
  const lancamentosRef = db.collection('users').doc(uid).collection('lancamentos')

  if (nParcelas > 1) {
    const grupoId = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const valorParcela = dados.valor / nParcelas
    const base = new Date(dados.data + 'T12:00:00')
    const ano = base.getFullYear()
    const dia = base.getDate()
    const docs = []

    for (let i = 0; i < nParcelas; i++) {
      const mesAlvo = base.getMonth() + i
      const ultimoDia = new Date(ano, mesAlvo + 1, 0).getDate()
      const diaFinal = Math.min(dia, ultimoDia)
      const d = new Date(ano, mesAlvo, diaFinal)
      const dataParc = d.toISOString().split('T')[0]

      const ref = await lancamentosRef.add({
        tipo: 'saida',
        valor: valorParcela,
        desc: `${dados.desc || ''} (${i + 1}/${nParcelas})`,
        data: dataParc,
        grupo: dados.grupo,
        item: dados.item,
        forma: dados.forma,
        cartao_nome: dados.cartao_nome || '',
        cartao_id: '',
        ticket_id: '',
        parcela_num: i + 1,
        total_parcelas: nParcelas,
        parcela_grupo: grupoId,
        uid,
        criado_em: FieldValue.serverTimestamp(),
      })
      docs.push(ref.id)
    }
    return docs
  }

  const ref = await lancamentosRef.add({
    tipo: dados.tipo || 'saida',
    valor: dados.valor,
    desc: dados.desc,
    data: dados.data,
    grupo: dados.grupo,
    item: dados.item,
    forma: dados.forma,
    cartao_nome: dados.cartao_nome || '',
    parcelas: 1,
    ticket_id: dados.ticket_id || '',
    categoria: dados.categoria || '',
    uid,
    criado_em: FieldValue.serverTimestamp(),
  })
  return [ref.id]
}

// Mesma coleção que a tela Agenda do dashboard usa (users/{uid}/agenda) e o
// mesmo formato de campos que window._saveCompromisso grava — um lembrete
// criado pelo WhatsApp aparece lá como qualquer outro compromisso. Os campos
// alerta_data/alerta_hora ficam vazios: o alerta local (push) é agendado pelo
// próprio dashboard no navegador (setTimeout), não faz sentido preenchê-los
// a partir daqui.
export async function salvarLembrete(uid, dados) {
  const ref = await db.collection('users').doc(uid).collection('agenda').add({
    titulo: dados.titulo,
    data: dados.data,
    hora: dados.hora || '',
    prioridade: dados.prioridade || 'media',
    tipo: dados.tipo || 'Compromisso',
    obs: dados.obs || '',
    alerta_data: '',
    alerta_hora: '',
    uid,
    criado_em: FieldValue.serverTimestamp(),
  })
  return ref.id
}
