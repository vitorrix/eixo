// Modo "ocultar valores" — borra qualquer "R$ ..." na tela (útil em compartilhamento
// de tela). Funciona varrendo o DOM por texto no formato do brl() e embrulhando cada
// ocorrência num <span> que o CSS borra, em vez de mexer em cada tela que exibe
// dinheiro — assim cobre a aplicação inteira, telas novas incluídas, sem precisar
// tocar o código de cada módulo.
const STORAGE_KEY = 'eixo:valoresOcultos'
const MONEY_RE = /R\$\s?-?[\d.,]+/g

let ativos = localStorage.getItem(STORAGE_KEY) === '1'
let observer = null
let scheduled = false

function mascararTextos(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT
      MONEY_RE.lastIndex = 0
      if (!MONEY_RE.test(node.nodeValue)) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent || parent.closest('.valor-money-wrap')) return NodeFilter.FILTER_REJECT
      if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)

  nodes.forEach(node => {
    const text = node.nodeValue
    const frag = document.createDocumentFragment()
    let lastIdx = 0
    MONEY_RE.lastIndex = 0
    let m
    while ((m = MONEY_RE.exec(text))) {
      if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
      const span = document.createElement('span')
      span.className = 'valor-money-wrap'
      span.textContent = m[0]
      frag.appendChild(span)
      lastIdx = m.index + m[0].length
    }
    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)))
    node.parentNode.replaceChild(frag, node)
  })
}

function agendarMascara() {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    mascararTextos(document.body)
  })
}

function iniciarObservador() {
  if (observer) return
  observer = new MutationObserver(agendarMascara)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}

function pararObservador() {
  observer?.disconnect()
  observer = null
}

export function valoresOcultosAtivos() {
  return ativos
}

export function alternarValoresOcultos() {
  ativos = !ativos
  localStorage.setItem(STORAGE_KEY, ativos ? '1' : '0')
  document.documentElement.classList.toggle('valores-ocultos', ativos)
  if (ativos) { mascararTextos(document.body); iniciarObservador() }
  else pararObservador()
  return ativos
}

// Chamado uma vez no boot — aplica o estado salvo (localStorage) antes da
// primeira pintura, pra não dar um flash com os valores visíveis.
export function iniciarValoresOcultos() {
  document.documentElement.classList.toggle('valores-ocultos', ativos)
  if (ativos) { mascararTextos(document.body); iniciarObservador() }
}
