// Presets de período pros relatórios (mesmo modelo do dropdown de datas do
// eGestor). Todas as funções retornam { de, ate } em ISO local 'YYYY-MM-DD',
// construído sem passar por UTC pra não escorregar um dia por causa de fuso.

export function isoLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// Segunda-feira como início da semana (padrão brasileiro de agenda comercial).
function inicioSemana(d) {
  const dow = (d.getDay() + 6) % 7 // 0 = segunda
  return addDays(d, -dow)
}

function primeiroDiaMes(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function ultimoDiaMes(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

// Cada preset é calculado relativo a "hoje" no momento da chamada.
export const PRESETS = [
  { key: 'hoje',            label: 'Hoje' },
  { key: 'ontem',           label: 'Ontem' },
  { key: 'esta-semana',     label: 'Esta semana' },
  { key: 'semana-passada',  label: 'Semana passada' },
  { key: 'ultimos-7',       label: 'Últimos 7 dias' },
  { key: 'ultimos-14',      label: 'Últimos 14 dias' },
  { key: 'ultimos-30',      label: 'Últimos 30 dias' },
  { key: 'este-mes',        label: 'Este mês' },
  { key: 'mes-passado',     label: 'Mês passado' },
]

export function presetRange(key, hoje = new Date()) {
  switch (key) {
    case 'hoje':           return { de: isoLocal(hoje), ate: isoLocal(hoje) }
    case 'ontem': {
      const o = addDays(hoje, -1)
      return { de: isoLocal(o), ate: isoLocal(o) }
    }
    case 'esta-semana':    return { de: isoLocal(inicioSemana(hoje)), ate: isoLocal(hoje) }
    case 'semana-passada': {
      const iniAtual = inicioSemana(hoje)
      const iniPassada = addDays(iniAtual, -7)
      const fimPassada = addDays(iniAtual, -1)
      return { de: isoLocal(iniPassada), ate: isoLocal(fimPassada) }
    }
    case 'ultimos-7':      return { de: isoLocal(addDays(hoje, -6)),  ate: isoLocal(hoje) }
    case 'ultimos-14':     return { de: isoLocal(addDays(hoje, -13)), ate: isoLocal(hoje) }
    case 'ultimos-30':     return { de: isoLocal(addDays(hoje, -29)), ate: isoLocal(hoje) }
    case 'este-mes':       return { de: isoLocal(primeiroDiaMes(hoje)), ate: isoLocal(ultimoDiaMes(hoje)) }
    case 'mes-passado': {
      const mesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      return { de: isoLocal(primeiroDiaMes(mesPassado)), ate: isoLocal(ultimoDiaMes(mesPassado)) }
    }
    default:               return { de: isoLocal(primeiroDiaMes(hoje)), ate: isoLocal(ultimoDiaMes(hoje)) }
  }
}

function brDate(iso) {
  if (!iso || iso.length < 10) return iso || ''
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

export function periodoLabel(de, ate) {
  if (!de && !ate) return 'Todo o período'
  if (de === ate) return brDate(de)
  return `${brDate(de)} – ${brDate(ate)}`
}
