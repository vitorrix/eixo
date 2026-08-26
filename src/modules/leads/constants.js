export const STATUS_META = {
  novo:         { label: 'Novo',          cls: 'badge-pendente' },
  em_followup:  { label: 'Em follow-up',  cls: 'badge-em-andamento' },
  sem_resposta: { label: 'Sem resposta',  cls: 'badge-prioridade-alta' },
  descartado:   { label: 'Descartado',    cls: 'badge-concluido' },
  convertido:   { label: 'Convertido',    cls: 'badge-recebido' },
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
  whatsapp_anuncio: { label: 'Anúncio Instagram', cls: 'badge-pf' },
  whatsapp_direto:  { label: 'WhatsApp direto',   cls: 'badge-pj' },
  // TODO: fase 2 - Instagram DM (instagram_direto)
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
