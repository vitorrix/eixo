import { el, svgEl } from '../../shared/utils/dom.js'
import { whatsappIcon } from '../../shared/utils/whatsapp.js'

// Glifo simplificado do Instagram (câmera + lente + flash), sem o gradiente
// oficial — só pra diferenciar rápido do WhatsApp, mesmo estilo de traço
// dos ícones do menu lateral. Usado no card do quadro e nos painéis de
// número por canal do Histórico.
export function instagramIcon() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '15', height: '15',
  })
  svg.append(
    svgEl('rect', { x: '2', y: '2', width: '20', height: '20', rx: '5' }),
    svgEl('circle', { cx: '12', cy: '12', r: '4' }),
    svgEl('line', { x1: '17.5', y1: '6.5', x2: '17.51', y2: '6.5' }),
  )
  return svg
}

export function canalIcon(canal) {
  return canal === 'instagram' ? instagramIcon() : whatsappIcon()
}

export const STATUS_META = {
  novo:         { label: 'Novo',          cls: 'badge-pendente' },
  em_followup:  { label: 'Em follow-up',  cls: 'badge-em-andamento' },
  sem_resposta: { label: 'Sem resposta',  cls: 'badge-prioridade-alta' },
  descartado:   { label: 'Descartado',    cls: 'badge-concluido' },
  convertido:   { label: 'Convertido',    cls: 'badge-recebido' },
}

// Ordem das colunas do quadro (estilo Notion/Trello) — Novo só recebe lead
// direto do bot (nunca é destino de um "arrastar pra cá"); Convertido e
// Descartado são colunas de saída, mostram só os mais recentes (o resto
// fica no Histórico, que tem filtro de período de verdade).
export const COLUNAS = [
  { status: 'novo',         titulo: '🆕 Novo',          aceitaDrop: false },
  { status: 'em_followup',  titulo: '📞 Em Follow-up',  aceitaDrop: true  },
  { status: 'sem_resposta', titulo: '🔇 Sem Resposta',  aceitaDrop: true  },
  { status: 'convertido',   titulo: '✅ Convertido',    aceitaDrop: true, limite: 15 },
  { status: 'descartado',   titulo: '🗑️ Descartado',    aceitaDrop: true, limite: 15 },
]

// Tira o DDI "55" do telefone cru do WhatsApp ("5511999990000" →
// "11999990000") — usado tanto pra exibir (formatarTelefone) quanto pra
// prefill do form de Cliente ao converter um lead (ver board.js).
export function telefoneLocalDigits(phone) {
  const digitos = (phone || '').replace(/\D/g, '')
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos
}

// Telefone do WhatsApp vem cru com DDI ("5511999990000") — tira o "55" e
// aplica a máscara nacional só pra exibir, nunca pra salvar/comparar.
export function formatarTelefone(phone) {
  const local = telefoneLocalDigits(phone)
  if (local.length < 10) return phone || '—'
  if (local.length <= 2) return local.length ? `(${local}` : ''
  if (local.length <= 6) return `(${local.slice(0, 2)}) ${local.slice(2)}`
  if (local.length <= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
}

// Nome de exibição: prioriza o nome dado (do WhatsApp ou renomeado à mão),
// senão cai pro telefone formatado — nunca mostra o número cru.
export function nomeExibicao(lead) {
  return lead.name || formatarTelefone(lead.phone)
}

// Pra localizar o contato de verdade fora do Eixo — telefone formatado se
// for WhatsApp; senão uma aproximação de "@" a partir do nome (a Graph API
// de buscarNomeInstagram às vezes retorna o username em vez do nome de
// exibição, então nem sempre é o handle real — é só uma pista pra achar no
// Instagram, não uma garantia). Usado no quadro (card) e no Histórico.
export function contatoLocalizavel(lead) {
  if (lead.phone) return formatarTelefone(lead.phone)
  if (lead.name) return '@' + lead.name.replace(/\s/g, '').toLowerCase()
  return 'Instagram Direct'
}

// Link pra abrir a conversa direto — clicado no ícone do canal no card do
// quadro e no Histórico. WhatsApp usa o telefone cru (com DDI, formato que
// wa.me espera). Instagram não tem endpoint de deep-link por igsid pra quem
// não é o dono da conta — ig.me/m/<usuário> é a melhor aproximação usando o
// mesmo "@" de contatoLocalizavel (nem sempre é o username exato: a Graph
// API às vezes devolve o nome de exibição em vez do username de verdade).
export function linkContatoDireto(lead) {
  if (canalDoLead(lead) === 'whatsapp') {
    const digits = (lead.phone || '').replace(/\D/g, '')
    return digits ? `https://wa.me/${digits}` : null
  }
  if (lead.name) return `https://ig.me/m/${lead.name.replace(/\s/g, '').toLowerCase()}`
  return null
}

// Card de anúncio (WhatsApp) e referral (Instagram) chegam como texto cru,
// às vezes bem longo (título + corpo do anúncio inteiro) — sem isso vira um
// parágrafo gigante que atropela o card/histórico. Corta pra um resumo
// "assertivo"; o texto completo continua acessível no atributo title
// (tooltip ao passar o mouse — app é desktop-only, ver CLAUDE.md).
export function resumoAnuncio(adContext, max = 60) {
  if (!adContext) return null
  const limpo = adContext.trim()
  return limpo.length > max ? `${limpo.slice(0, max).trim()}…` : limpo
}

export const DISCARD_REASON_META = {
  crianca:            'Criança',
  idoso:               'Idoso',
  cobrador_fornecedor: 'Cobrador/fornecedor',
  sem_interesse:       'Sem interesse',
  duplicado:           'Duplicado',
  outro:               'Outro',
}

export const SOURCE_META = {
  whatsapp_anuncio:  { label: 'Anúncio Instagram → WhatsApp', cls: 'badge-pf', canal: 'whatsapp' },
  whatsapp_direto:   { label: 'WhatsApp direto',              cls: 'badge-pj', canal: 'whatsapp' },
  instagram_anuncio: { label: 'Anúncio → Instagram Direct',   cls: 'badge-pf', canal: 'instagram' },
  instagram_direto:  { label: 'Instagram Direct',             cls: 'badge-pj', canal: 'instagram' },
}

// Separa os leads por canal de origem pro quadro (2 quadros iguais — um por
// canal — em vez de misturar tudo com só um ícone de diferença).
export function canalDoLead(lead) {
  return SOURCE_META[lead.source]?.canal || 'whatsapp'
}

// Ligação/chamada de vídeo perdida é o sinal de intenção de compra mais
// forte que existe — quem liga quer resposta rápida. Hoje só é marcado à
// mão (ver marcarChamadaPerdida em service.js); os TODOs em
// whatsapp-bot/src/leads.js e functions/instagramLeads.js marcam onde
// entraria a detecção automática quando as fontes passarem a informar isso.
export function temChamadaPerdida(lead) {
  return !!lead.missedCallAt
}

export function textoChamadaPerdida(lead) {
  if (lead.missedCallTipo === 'video') return '📹 Chamada de vídeo perdida — retornar com prioridade'
  if (lead.missedCallTipo === 'audio') return '📞 Ligação perdida — retornar com prioridade'
  return '📞 Chamada perdida — retornar com prioridade'
}

// Nº da tentativa de contato atual: entrar em Em Follow-up já é a 1ª
// tentativa — o "Iniciar" do drag pra essa coluna agora exige descrever o
// que foi tratado (ver followUpForm.js), então já grava a 1ª nota junto.
// Cada "Nota" registrada depois (marcarContatado, em notes[]) é uma
// tentativa a mais. Depois da 3ª sem resposta, a equipe descarta
// manualmente — não é automático. Math.max(1, ...) preserva o card em leads
// que já estavam em follow-up antes dessa mudança (0 notas = mostrava "1").
export function contarTentativas(lead) {
  return Math.max(1, lead.notes?.length || 0)
}

// Nível de interesse do lead — marcado à mão pela equipe ao iniciar/reagendar
// o follow-up ou ao registrar uma nova nota (mantém selecionado o valor
// anterior, com opção de trocar). 1 estrela = pouco, 3 = alto interesse.
export const INTERESSE_META = {
  1: { estrelas: '⭐', label: 'Pouco interesse' },
  2: { estrelas: '⭐⭐', label: 'Médio interesse' },
  3: { estrelas: '⭐⭐⭐', label: 'Alto interesse' },
}

// Seletor de estrelas reutilizável (form de Iniciar/Reagendar Follow-up e
// modal de Nota) — clicar numa estrela marca até ali; clicar de novo na
// última estrela já marcada limpa a seleção (não é obrigatório opinar).
export function criarSeletorInteresse(valorInicial = null) {
  let valor = valorInicial || null
  const btns = [1, 2, 3].map(n => {
    const btn = el('button', { type: 'button', class: 'lead-interesse-star', title: INTERESSE_META[n].label }, '⭐')
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      valor = valor === n ? null : n
      render()
    })
    return btn
  })
  function render() {
    btns.forEach((b, i) => b.classList.toggle('ativa', valor != null && i < valor))
  }
  render()
  const wrap = el('div', { class: 'lead-interesse-seletor' }, ...btns)
  return { el: wrap, getValue: () => valor }
}

function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDate(ts) {
  if (!ts) return null
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
}

// Classifica o prazo de retorno em 3 níveis pra guiar o alerta visual da
// fila de Follow-up (e o contador do menu lateral): atrasado (vermelho),
// hoje (âmbar — mesma cor de "atenção" já usada no resto do Eixo, não
// laranja como cor de ação/botão, que no sistema é sempre verde), futuro
// (neutro).
export function urgenciaFollowUp(nextFollowUpAt) {
  const d = toDate(nextFollowUpAt)
  if (!d) return 'futuro'
  const agora = new Date()
  if (d < agora) return 'atrasado'
  const diaISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (diaISO === hojeISO()) return 'hoje'
  return 'futuro'
}

export const URGENCIA_META = {
  atrasado: { cor: '#d93025', icone: '🔴', prefixo: 'Atrasado — retornar era' },
  hoje:     { cor: '#f59e0b', icone: '🟠', prefixo: 'Retornar hoje às' },
  futuro:   { cor: '#6b7280', icone: '⚪', prefixo: 'Retornar dia' },
}

export function formatDataHora(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dia}/${mes} às ${hora}h${min !== '00' ? min : ''}`
}

// Texto pronto pra linha de alerta da fila de Follow-up, já no formato do
// print de referência ("Atrasado — retornar era 18/09 às 10h").
export function textoUrgencia(nextFollowUpAt) {
  const nivel = urgenciaFollowUp(nextFollowUpAt)
  const meta = URGENCIA_META[nivel]
  if (nivel === 'hoje') {
    const d = toDate(nextFollowUpAt)
    const hora = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return { nivel, meta, texto: `${meta.prefixo} ${hora}h${min !== '00' ? min : ''}` }
  }
  return { nivel, meta, texto: `${meta.prefixo} ${formatDataHora(nextFollowUpAt)}` }
}
