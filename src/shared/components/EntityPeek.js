import { el, svgEl } from '../utils/dom.js'
import { maskCPF, maskCNPJ } from '../utils/formatters.js'
import { findCountryByDial, maskPhoneForCountry } from '../utils/countries.js'

function eyeIcon() {
  return svgEl('svg',
    { xmlns: 'http://www.w3.org/2000/svg', width: '15', height: '15',
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    svgEl('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
    svgEl('circle', { cx: '12', cy: '12', r: '3' })
  )
}

export function createEntityPeek({ getEntity, onEdit }) {
  let popover = null

  function closePopover() {
    if (!popover) return
    popover.remove()
    popover = null
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onEsc)
  }

  function onDocClick(e) {
    if (popover && !popover.contains(e.target) && e.target !== btn) closePopover()
  }

  function onEsc(e) {
    if (e.key === 'Escape') closePopover()
  }

  function buildPopover(entity) {
    const body = el('div', { class: 'peek-body' })

    // Linha topo: código legado + link editar
    const topRow = el('div', { class: 'peek-top-row' })
    topRow.appendChild(
      el('span', { class: 'peek-cod' },
        entity.codLegado ? `Cód interno: ${entity.codLegado}` : ''
      )
    )
    if (onEdit) {
      const editLink = el('button', { type: 'button', class: 'peek-edit-link' }, '✏️ editar')
      editLink.addEventListener('click', () => { closePopover(); onEdit(entity) })
      topRow.appendChild(editLink)
    }
    body.appendChild(topRow)

    // Nome em destaque
    body.appendChild(el('strong', { class: 'peek-name' }, entity.name || '—'))

    // Documento
    if (entity.document) {
      const isPJ = entity.type === 'pj'
      const docStr = isPJ ? maskCNPJ(entity.document) : maskCPF(entity.document)
      body.appendChild(el('span', {}, `${isPJ ? 'CNPJ' : 'CPF'}: ${docStr}`))
    }

    // Telefone
    if (entity.phone) {
      const country = findCountryByDial(entity.phoneCountry || '55')
      const prefix = country.dial !== '55' ? `+${country.dial} ` : ''
      body.appendChild(el('span', {}, `Fone: ${prefix}${maskPhoneForCountry(entity.phone, country)}`))
    }

    // E-mail
    if (entity.email) {
      body.appendChild(el('span', { class: 'peek-muted' }, entity.email))
    }

    // Endereço
    const addr = entity.address || {}
    if (addr.logradouro || addr.cidade) {
      body.appendChild(el('strong', { class: 'peek-section' }, 'Endereço'))

      if (addr.logradouro) {
        let linha = addr.logradouro
        if (addr.numero)      linha += `, ${addr.numero}`
        if (addr.complemento) linha += ` - ${addr.complemento}`
        body.appendChild(el('span', {}, linha))
      }
      if (addr.bairro) body.appendChild(el('span', {}, addr.bairro))

      const cityLine = [addr.cidade, addr.estado].filter(Boolean).join(' - ')
      if (cityLine) body.appendChild(el('span', {}, cityLine))
    }

    return el('div', { class: 'peek-popover' },
      el('div', { class: 'peek-header' }, 'Informação'),
      body
    )
  }

  function openPopover(entity) {
    closePopover()
    popover = buildPopover(entity)
    document.body.appendChild(popover)

    // Posiciona abaixo do botão, alinhado pela borda direita
    const r   = btn.getBoundingClientRect()
    const pw  = 280
    let   left = r.right - pw + window.scrollX
    if (left < 8) left = 8
    popover.style.top  = `${r.bottom + window.scrollY + 4}px`
    popover.style.left = `${left}px`

    setTimeout(() => {
      document.addEventListener('click', onDocClick, true)
      document.addEventListener('keydown', onEsc)
    }, 0)
  }

  const btn = el('button', { type: 'button', class: 'peek-btn', title: 'Ver cadastro' })
  btn.appendChild(eyeIcon())

  btn.addEventListener('click', e => {
    e.stopPropagation()
    if (popover) { closePopover(); return }
    const entity = getEntity()
    if (!entity) return
    openPopover(entity)
  })

  return { el: btn, close: closePopover }
}
