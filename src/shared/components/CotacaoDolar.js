import { el } from '../utils/dom.js'

const API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'
const REFRESH_MS = 5 * 60 * 1000 // atualiza a cada 5 min

export function createCotacaoWidget() {
  const widget = el('div', { class: 'cotacao-widget' })
  const label  = el('span', { class: 'cotacao-label' }, '🇺🇸 USD')
  const valor  = el('span', { class: 'cotacao-valor' }, '—')
  const change = el('span', { class: 'cotacao-change' })
  const hora   = el('span', { class: 'cotacao-hora' })

  widget.append(
    el('div', { class: 'cotacao-row' }, label, valor),
    el('div', { class: 'cotacao-row cotacao-row-sub' }, change, hora)
  )

  let intervalId = null

  async function fetch_rate() {
    try {
      const res  = await fetch(API_URL)
      const data = await res.json()
      const usd  = data.USDBRL

      const bid    = parseFloat(usd.bid)
      const pct    = parseFloat(usd.pctChange)
      const isUp   = pct >= 0

      valor.textContent = `R$ ${bid.toFixed(4).replace('.', ',')}`
      valor.className   = `cotacao-valor ${isUp ? 'cotacao-up' : 'cotacao-down'}`

      change.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(2)}%`
      change.className   = `cotacao-change ${isUp ? 'cotacao-up' : 'cotacao-down'}`

      const now  = new Date()
      hora.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch {
      valor.textContent  = 'indisponível'
      valor.className    = 'cotacao-valor cotacao-error'
      change.textContent = ''
      hora.textContent   = ''
    }
  }

  fetch_rate()
  intervalId = setInterval(fetch_rate, REFRESH_MS)

  // Retorna função de cleanup para o caller cancelar o intervalo se necessário
  widget.cleanup = () => clearInterval(intervalId)

  return widget
}
