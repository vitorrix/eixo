import { el, svgEl } from '../utils/dom.js'

// Um card só pra botão de ação + busca + filtro + contador — protótipo
// validado em Pedidos, replicado pro resto do sistema. Antes esses
// controles ficavam soltos direto no fundo cinza da página, sem "casa",
// diferente do resto do Eixo (tudo mais já vive em card).
export function toolbarCard(...children) {
  return el('div', { class: 'toolbar-card' }, ...children)
}

// Embrulha um <input> de busca já existente com o ícone de lupa, dentro
// do mesmo card (em vez de uma barra solta abaixo do toolbar).
export function searchWithIcon(inputEl) {
  const icon = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '15', height: '15', class: 'toolbar-card-search-icon',
  })
  icon.append(
    svgEl('path', { d: 'M11 19a8 8 0 100-16 8 8 0 000 16z' }),
    svgEl('path', { d: 'M21 21l-4.35-4.35' }),
  )
  return el('div', { class: 'toolbar-card-search' }, icon, inputEl)
}

// Agrupa período/contador do lado direito do card, sem esticar com
// justify-content:space-between (o que deixava o contador boiando sozinho).
export function toolbarMeta(...children) {
  return el('div', { class: 'toolbar-card-meta' }, ...children)
}
