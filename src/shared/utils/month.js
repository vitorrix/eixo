// Helpers de mês pra relatórios/telas com navegação por período (YYYY-MM).
export function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function monthKey(dataISO) {
  return (dataISO || '').slice(0, 7)
}
export function monthLabel(ym) {
  const [y, m] = ym.split('-')
  const ms = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${ms[+m - 1]} ${y}`
}
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
