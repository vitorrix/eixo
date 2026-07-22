import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { getCurrentProfile } from '../../auth/session.js'
import { maskPhone, brl, relativeTime, toNumero } from '../../shared/utils/formatters.js'
import { whatsappLink, whatsappIcon } from '../../shared/utils/whatsapp.js'
import { subscribeAniversariantes } from '../clientes/service.js'
import { subscribeBotStatus } from '../configuracoes/service.js'
import { subscribeFinanceiro } from '../financeiro/service.js'
import { nowMonth, monthKey, monthLabel, shiftMonth } from '../../shared/utils/month.js'
import { collection, query, where, getCountFromServer } from 'firebase/firestore'
import { db } from '../../firebase.js'

const MODULE_CARDS = [
  { label: 'Pedidos',      sub: 'Gerenciar pedidos',       path: '/pedidos',       color: '#6366f1', icon: 'pedidos'      },
  { label: 'Clientes',     sub: 'Cadastro de clientes',    path: '/clientes',      color: '#10B981', icon: 'clientes'     },
  { label: 'Fornecedores', sub: 'Cadastro de fornecedores',path: '/fornecedores',  color: '#f59e0b', icon: 'fornecedores' },
  { label: 'Financeiro',   sub: 'Receitas e despesas',     path: '/financeiro',    color: '#3b82f6', icon: 'financeiro'   },
  { label: 'Produtos',     sub: 'Catálogo de produtos',    path: '/produtos',      color: '#ec4899', icon: 'produtos'     },
]

const STAT_CARDS = [
  { label: 'Clientes', collection: 'clientes', color: '#10B981', path: '/clientes', sub: 'registros'  },
  { label: 'Pedidos',  collection: 'pedidos',  color: '#6366f1', path: '/pedidos',  sub: 'este mês'   },
]

const ICON_PATHS = {
  pedidos:      ['M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z','M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12'],
  clientes:     ['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2','M12 11a4 4 0 100-8 4 4 0 000 8z'],
  fornecedores: ['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z','M9 22V12h6v10'],
  financeiro:   ['M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6'],
  produtos:     ['M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z','M7 7h.01'],
}

function buildIcon(key, color) {
  const paths = ICON_PATHS[key] || []
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: color,
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '22', height: '22',
  })
  for (const d of paths) svg.appendChild(svgEl('path', { d }))
  return svg
}

// ── Mural de Recados ──────────────────────────────────────────────────
// Feed único de avisos do dia — hoje só aniversariantes (dados reais), mas
// já preparado para os próximos tipos que vão vir do módulo Financeiro
// quando ele existir de verdade (contas a pagar/receber). Cada tipo tem
// sua cor+ícone; a estrutura do card é sempre a mesma pra ficar uniforme
// com o resto do dashboard, em vez do quadro amarelo isolado que existia.
const RECADO_TIPOS = {
  aniversario: { color: '#f59e0b', paths: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z'] },
  recebimento: { color: '#10B981', paths: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M8 12l4 4 4-4', 'M12 8v8'] },
  pagamento:   { color: '#d93025', paths: ['M12 22a10 10 0 100-20 10 10 0 000 20z', 'M16 12l-4-4-4 4', 'M12 16V8'] },
  aviso:       { color: '#3b82f6', paths: ['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 01-3.46 0'] },
  alerta:      { color: '#d93025', paths: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'] },
}

function buildRecadoIcon(tipo) {
  const cfg = RECADO_TIPOS[tipo] || RECADO_TIPOS.aviso
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: cfg.color,
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '18', height: '18',
  })
  for (const d of cfg.paths) svg.appendChild(svgEl('path', { d }))
  return svg
}

function muralItem({ tipo, titulo, detalhe, action }) {
  const cfg = RECADO_TIPOS[tipo] || RECADO_TIPOS.aviso
  return el('div', { class: 'mural-item' },
    el('div', { class: 'mural-item-icon', style: `background:${cfg.color}1a` }, buildRecadoIcon(tipo)),
    el('div', { class: 'mural-item-body' },
      el('div', { class: 'mural-item-title' }, titulo),
      detalhe ? el('div', { class: 'mural-item-detalhe' }, detalhe) : null,
    ),
    action,
  )
}

function buildMuralEmptyIcon() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '28', height: '28',
  })
  svg.appendChild(svgEl('path', { d: 'M22 11.08V12a10 10 0 11-5.93-9.14' }))
  svg.appendChild(svgEl('path', { d: 'M22 4L12 14.01l-3-3' }))
  return svg
}

// O bot grava um "estou vivo" a cada 5min. Passou de 15min sem sinal, tratamos
// como fora do ar — cobre os casos em que ele não conseguiria avisar nada
// (processo morto, máquina desligada, internet caída).
const BOT_SEM_SINAL_MS = 15 * 60 * 1000

// Vira um recado de alerta, ou null quando está tudo certo. Status ausente
// (bot nunca gravou) também não alerta — evita alarme falso antes do primeiro
// deploy do heartbeat.
function recadoBotStatus(status) {
  if (!status) return null

  const atualizadoEm = status.atualizadoEm?.toDate?.()

  if (status.conectado === false) {
    return {
      tipo: 'alerta',
      titulo: 'Bot do WhatsApp fora do ar',
      detalhe: status.motivo || 'Precisa parear de novo pelo QR code.',
    }
  }

  if (atualizadoEm && Date.now() - atualizadoEm.getTime() > BOT_SEM_SINAL_MS) {
    return {
      tipo: 'alerta',
      titulo: 'Bot do WhatsApp sem sinal',
      detalhe: `Último sinal ${relativeTime(atualizadoEm)}. As listas dos fornecedores podem não estar entrando.`,
    }
  }

  // Conectado e pulsando, mas caindo demais. É o caso que passou despercebido
  // até 21/07/26: pelos dois testes acima o bot parecia saudável enquanto
  // reconectava sem parar e perdia lista.
  if (status.instavel) {
    return {
      tipo: 'alerta',
      titulo: 'Bot do WhatsApp instável',
      detalhe: `${status.quedasRecentes} quedas na última hora. Está conectado, mas as listas podem estar entrando pela metade.`,
    }
  }

  return null
}

function buildMural(recados) {
  const body = recados.length
    ? el('div', { class: 'mural-list' }, ...recados.map(muralItem))
    : el('div', { class: 'mural-empty' }, buildMuralEmptyIcon(), el('p', {}, 'Tudo em dia — nenhum recado por aqui.'))

  return el('div', { class: 'mural-card' },
    el('div', { class: 'mural-header' },
      el('span', { class: 'mural-title' }, 'Mural de Recados'),
      recados.length ? el('span', { class: 'count-badge' }, String(recados.length)) : null,
    ),
    body,
  )
}

// Faturamento real dos últimos 6 meses: soma dos Recebimentos já liquidados
// (regime de caixa) por mês da data de liquidação. Mesma convenção dos
// relatórios financeiros.
function calcularFaturamento(lancamentos) {
  const meses = []
  for (let i = 5; i >= 0; i--) {
    const ym = shiftMonth(nowMonth(), -i)
    meses.push({ ym, label: monthLabel(ym).split(' ')[0], value: 0 })
  }
  const porMes = new Map(meses.map(m => [m.ym, m]))
  lancamentos.forEach(l => {
    if (l.tipo !== 'receber' || !l.liquidado) return
    const m = porMes.get(monthKey(l.dataLiquidacao))
    if (m) m.value += toNumero(l.valor)
  })
  return meses
}

function buildRevenueChart(lancamentos) {
  const dados = calcularFaturamento(lancamentos)
  const max = Math.max(...dados.map(d => d.value), 1)
  const temDados = dados.some(d => d.value > 0)

  const last = dados[dados.length - 1]
  const prev = dados[dados.length - 2]
  const deltaPct = prev.value > 0 ? Math.round(((last.value - prev.value) / prev.value) * 100) : null

  const headlineValue = el('span', { class: 'chart-headline-value' }, brl(last.value))
  const headlineDelta = deltaPct !== null
    ? el('span', { class: `chart-headline-delta ${deltaPct >= 0 ? 'up' : 'down'}` }, `${deltaPct >= 0 ? '▲' : '▼'} ${Math.abs(deltaPct)}%`)
    : el('span', {})
  const headlineLabel = el('span', { class: 'chart-headline-label' }, last.label)

  function showMonth(d) {
    headlineValue.textContent = brl(d.value)
    headlineLabel.textContent = d.label
  }
  function resetHeadline() {
    headlineValue.textContent = brl(last.value)
    headlineLabel.textContent = last.label
  }

  const barCols = dados.map(d => {
    const fill = el('div', { class: 'chart-bar-fill' })
    fill.style.height = `${Math.round((d.value / max) * 100)}%`
    const bar = el('div', { class: 'chart-bar' }, fill)
    const col = el('div', { class: 'chart-bar-col' }, bar)
    col.addEventListener('mouseenter', () => showMonth(d))
    col.addEventListener('mouseleave', resetHeadline)
    return col
  })

  const axisLabels = dados.map(d => el('span', { class: 'chart-axis-label' }, d.label))

  return el('div', { class: 'chart-card' },
    el('div', { class: 'chart-header' },
      el('span', { class: 'chart-title' }, 'Faturamento'),
      el('span', { class: 'chart-subtitle' }, 'últimos 6 meses')
    ),
    el('div', { class: 'chart-headline' }, headlineValue, headlineDelta, headlineLabel),
    el('div', { class: 'chart-plot' }, ...barCols),
    el('div', { class: 'chart-axis-row' }, ...axisLabels),
    temDados
      ? null
      : el('p', { class: 'chart-note' }, 'Nenhum recebimento liquidado nos últimos 6 meses.')
  )
}

export function render(container) {
  const profile = getCurrentProfile()
  const name = (profile?.name || profile?.email || '').split(' ')[0]

  const greeting = el('h2', {})
  greeting.textContent = `Olá, ${name}!`
  const sub = el('p', { class: 'text-muted' }, 'Bem-vindo ao Eixo. Selecione um módulo para começar.')

  // Stat cards
  const today = new Date()
  const yy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const mesStart = `${yy}-${mm}-01`
  const mesEnd   = `${yy}-${mm}-31`

  const statCards = STAT_CARDS.map(s => {
    const valueEl = el('div', { class: 'stat-card-value' }, '—')
    const card = el('div', { class: 'stat-card' },
      el('div', { class: 'stat-card-accent', style: `background:${s.color}` }),
      el('div', { class: 'stat-card-body' },
        el('div', { class: 'stat-card-label' }, s.label),
        valueEl,
        el('div', { class: 'stat-card-sub' }, s.sub)
      )
    )
    card.addEventListener('click', () => { window.location.hash = s.path })

    const col = collection(db, s.collection)
    const q = s.collection === 'pedidos'
      ? query(col, where('dataContato', '>=', mesStart), where('dataContato', '<=', mesEnd))
      : col

    getCountFromServer(q)
      .then(snap => { valueEl.textContent = snap.data().count })
      .catch(() => { valueEl.textContent = '?' })

    return card
  })

  const muralWrap = el('div', { class: 'mural-wrap' })

  // Module shortcut cards
  const moduleCards = MODULE_CARDS.map(m => {
    const wrap = el('div', { class: 'dash-card-icon-wrap', style: `background:${m.color}1a` },
      buildIcon(m.icon, m.color)
    )
    const card = el('div', { class: 'dash-card' },
      wrap,
      el('div', {},
        el('div', { class: 'dash-card-label' }, m.label),
        el('div', { class: 'dash-card-sub' }, m.sub)
      )
    )
    card.addEventListener('click', () => { window.location.hash = m.path })
    return card
  })

  const chartWrap = el('div', { class: 'chart-wrap' })

  mount(container,
    el('div', { class: 'page-header' }, greeting, sub),
    el('div', { class: 'dashboard-section' },
      el('p', { class: 'section-label' }, 'Acesso rápido'),
      el('div', { class: 'dashboard-cards' }, ...moduleCards),
    ),
    el('div', { class: 'dashboard-section stat-cards' }, ...statCards),
    el('div', { class: 'dashboard-section dashboard-row' }, muralWrap, chartWrap)
  )

  const unsubFinanceiro = subscribeFinanceiro(
    lancamentos => mount(chartWrap, buildRevenueChart(lancamentos)),
    () => mount(chartWrap, buildRevenueChart([]))
  )

  // O Mural junta duas fontes assíncronas (aniversariantes + status do bot);
  // cada uma guarda seu estado e redesenha o conjunto quando muda. Alerta do
  // bot vem primeiro — é operacional e urgente, aniversário não.
  let aniversariantes = []
  let botStatus = null

  function renderMural() {
    const recados = []
    const alertaBot = recadoBotStatus(botStatus)
    if (alertaBot) recados.push(alertaBot)

    aniversariantes.forEach(c => {
      const phone = c.phone || ''
      const primeiroNome = (c.name || '').split(' ')[0]
      const link = whatsappLink(phone, c.phoneCountry, `Feliz aniversário, ${primeiroNome}! 🎉 Um abraço da equipe Baruk Technology.`)
      const action = link
        ? el('a', { href: link, target: '_blank', rel: 'noopener', class: 'mural-item-action', title: 'Parabenizar no WhatsApp' }, whatsappIcon())
        : null
      recados.push({
        tipo: 'aniversario',
        titulo: c.name,
        detalhe: `Aniversário hoje${phone ? ' · ' + maskPhone(phone) : ''}`,
        action,
      })
    })

    mount(muralWrap, buildMural(recados))
  }

  const unsubBirthday = subscribeAniversariantes(lista => {
    aniversariantes = lista
    renderMural()
  })

  const unsubBotStatus = subscribeBotStatus(
    status => { botStatus = status; renderMural() },
    err => console.error('Erro ao acompanhar o status do bot:', err)
  )

  // O alerta é por tempo decorrido ("sem sinal há 15min"), então precisa ser
  // reavaliado mesmo sem evento novo do Firestore — senão a tela fica dizendo
  // que está tudo bem enquanto o sinal envelhece.
  const revisaoStatus = setInterval(renderMural, 60 * 1000)

  return () => {
    unsubBirthday?.()
    unsubFinanceiro?.()
    unsubBotStatus?.()
    clearInterval(revisaoStatus)
  }
}
