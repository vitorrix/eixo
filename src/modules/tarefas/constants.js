export const PRIORIDADES = [
  { key: 'baixa', label: 'Baixa' },
  { key: 'media', label: 'Média' },
  { key: 'alta',  label: 'Alta' },
]
export const STATUS_META = {
  pendente:     { label: 'Pendente',     cls: 'badge-pendente' },
  em_andamento: { label: 'Em andamento', cls: 'badge-em-andamento' },
  concluida:    { label: 'Concluída',    cls: 'badge-concluido' },
}
export const STATUS_ORDER = ['pendente', 'em_andamento', 'concluida']
export const PRIORIDADE_META = {
  baixa: { label: 'Baixa', cls: 'badge-prioridade-baixa' },
  media: { label: 'Média', cls: 'badge-prioridade-media' },
  alta:  { label: 'Alta',  cls: 'badge-prioridade-alta' },
}
// Sentinela alta o bastante pra empurrar tarefa sem prazo pro fim da lista
// quando ordenado por prazo, sem precisar tratar null/undefined à parte.
export const SEM_PRAZO = '9999-12-31T23:59'

export function nowLocalDT() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function isAtrasada(t) {
  return !!t.prazo && t.status !== 'concluida' && t.prazo < nowLocalDT()
}

export function proximoStatus(atual) {
  const i = STATUS_ORDER.indexOf(atual)
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length]
}
