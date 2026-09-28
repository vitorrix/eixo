// Tema claro/escuro — aplica a classe "tema-escuro" em <html>, que o
// global.css usa pra sobrescrever as CSS variables de cor (ver :root.tema-escuro).
// Sem preferência salva, segue o tema do sistema operacional.
const STORAGE_KEY = 'eixo:tema'

function preferenciaSistemaEscura() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
}

function lerEscuroSalvo() {
  const salvo = localStorage.getItem(STORAGE_KEY)
  if (salvo === 'escuro') return true
  if (salvo === 'claro') return false
  return preferenciaSistemaEscura()
}

let escuro = lerEscuroSalvo()

export function temaEscuroAtivo() {
  return escuro
}

export function alternarTema() {
  escuro = !escuro
  localStorage.setItem(STORAGE_KEY, escuro ? 'escuro' : 'claro')
  document.documentElement.classList.toggle('tema-escuro', escuro)
  return escuro
}

// Chamado uma vez no boot — aplica o estado salvo antes da primeira pintura.
export function iniciarTema() {
  document.documentElement.classList.toggle('tema-escuro', escuro)
}
