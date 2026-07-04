import { el, svgEl } from '../utils/dom.js'

const ICON_PATHS = {
  edit: ['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2'],
}

function icon(key) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: 16, height: 16,
  })
  ICON_PATHS[key].forEach(d => svg.appendChild(svgEl('path', { d })))
  return svg
}

function iconButton(key, { title, variant, onClick }) {
  const btn = el('button', {
    type: 'button',
    class: `icon-btn icon-btn-${variant}`,
    title,
    'aria-label': title,
  }, icon(key))
  btn.addEventListener('click', onClick)
  return btn
}

export function renderRowActions({ canEdit, canDelete, onEdit, onDelete }) {
  const wrap = el('div', { class: 'row-actions' })
  if (canEdit) wrap.appendChild(iconButton('edit', { title: 'Editar', variant: 'edit', onClick: onEdit }))
  if (canDelete) wrap.appendChild(iconButton('trash', { title: 'Excluir', variant: 'delete', onClick: onDelete }))
  return wrap
}
