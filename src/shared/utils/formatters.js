export function maskCPF(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

export function maskCNPJ(v) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

export function maskPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

export function formatDocument(type, raw) {
  const d = raw.replace(/\D/g, '')
  return type === 'pf' ? maskCPF(d) : maskCNPJ(d)
}

export function maskCEP(v) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function rawDigits(v) {
  return v.replace(/\D/g, '')
}

export function brl(v) {
  return (v || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  })
}

// Máscara pra campo de custo/valor digitado — número contínuo (1234) vira
// "R$ 1.234" enquanto digita, sem casas decimais (mesmo padrão do brl()).
export function maskMoeda(v) {
  const digits = rawDigits(v || '')
  return digits ? brl(parseInt(digits, 10)) : ''
}

export function moedaParaNumero(v) {
  const digits = rawDigits(v || '')
  return digits ? parseInt(digits, 10) : 0
}

export function shortDate(iso) {
  if (!iso || iso.length < 10) return iso || '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

// Retorna "MM-DD" para queries de aniversário
export function birthdayMD(dateStr) {
  if (!dateStr || dateStr.length < 10) return ''
  return dateStr.slice(5, 10) // "YYYY-MM-DD" → "MM-DD"
}

export function fullDate(iso) {
  if (!iso || iso.length < 10) return iso || '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

// Aceita Firestore Timestamp, Date ou string/number — retorna "há X min/h/dias"
export function relativeTime(timestamp) {
  if (!timestamp) return '—'
  const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `há ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `há ${diffD}d`
}
