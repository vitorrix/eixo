// Helpers para construção segura de DOM (evita innerHTML com dados externos)

export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag)
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'class') element.className = val
    else if (key === 'id') element.id = val
    else if (key.startsWith('data-')) element.dataset[key.slice(5)] = val
    else element.setAttribute(key, val)
  }
  for (const child of children) {
    if (typeof child === 'string') element.appendChild(document.createTextNode(child))
    else if (child instanceof Node) element.appendChild(child)
  }
  return element
}

// Cria elementos SVG com namespace correto (nunca usar innerHTML para SVG)
export function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val)
  for (const child of children) {
    if (child instanceof Node) el.appendChild(child)
  }
  return el
}

export function text(str) {
  return document.createTextNode(String(str))
}

export function mount(container, ...nodes) {
  container.replaceChildren(...nodes)
}
