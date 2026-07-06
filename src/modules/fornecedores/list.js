import { el, mount } from '../../shared/utils/dom.js'
import { can } from '../../auth/session.js'
import { findCountryByDial, maskPhoneForCountry } from '../../shared/utils/countries.js'
import { whatsappLink, whatsappIcon } from '../../shared/utils/whatsapp.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { toastError, toastSuccess } from '../../shared/components/Toast.js'
import { deleteFornecedor } from './service.js'
import { renderFornecedorForm } from './form.js'
import { validationStatus, VALIDATION_LABELS } from './validation.js'

const CATEGORIA_LABELS = { apple: 'Apple', android: 'Android', seminovo: 'S/N', acessorios: 'Acessórios' }

export function renderFornecedorList(container, fornecedores) {
  const canCreate = can('fornecedores', 'create')
  const canEdit   = can('fornecedores', 'edit')
  const canDelete = can('fornecedores', 'delete')

  const searchInput = el('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por nome, documento, telefone ou box...',
  })

  const countBadge = el('span', { class: 'count-badge' }, `${fornecedores.length}`)
  const title = el('h2', {}, 'Fornecedores ', countBadge)
  const toolbar = el('div', { class: 'toolbar' }, title)

  if (canCreate) {
    const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo Fornecedor')
    addBtn.addEventListener('click', () => openFornecedorModal(null))
    toolbar.appendChild(addBtn)
  }

  let sortCol = 'name'
  let sortDir = 'asc'

  const SORT_DEFS = [
    { key: 'name',       label: 'Nome',          cls: '' },
    { key: 'type',       label: 'Tipo',          cls: '' },
    { key: 'phone',      label: 'Telefone',      cls: '' },
    { key: 'categorias', label: 'Categorias',    cls: '' },
    { key: 'comunidade', label: 'Comunidade',    cls: 'col-center' },
    { key: 'validacao',  label: 'Validação',     cls: '' },
    { key: 'box',        label: 'Box / Galeria', cls: '' },
  ]

  function sortValue(f, key) {
    switch (key) {
      case 'name':       return (f.name || '').toLowerCase()
      case 'type':       return f.type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'
      case 'phone':       return (f.phone || '').replace(/\D/g, '').padStart(15, '0')
      case 'categorias': return (f.categorias || []).map(c => CATEGORIA_LABELS[c] || c).sort().join(', ')
      case 'comunidade': return f.comunidade ? 1 : 0
      case 'validacao':  return validationStatus(f.lastValidatedAt).daysLeft ?? -Infinity
      case 'box':        return (f.box || '').toLowerCase()
      default:           return ''
    }
  }

  const sortThs = SORT_DEFS.map(({ key, label, cls }) => {
    const clsList = [cls, 'th-sortable'].filter(Boolean).join(' ')
    const ind = el('span', { class: 'sort-ind' }, '')
    const th = el('th', { class: clsList }, label, ind)
    th.addEventListener('click', () => {
      if (sortCol === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      else { sortCol = key; sortDir = 'asc' }
      updateSortHeaders()
      applyFilterAndSort()
    })
    return th
  })

  function updateSortHeaders() {
    SORT_DEFS.forEach(({ key }, i) => {
      const th = sortThs[i]
      th.classList.toggle('sort-active', sortCol === key)
      th.querySelector('.sort-ind').textContent = sortCol === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''
    })
  }
  updateSortHeaders()

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {}, ...sortThs,
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, 'Ações')] : [])
      )
    ),
    tbody
  )

  const tableWrapper = el('div', { class: 'table-wrapper' }, table)
  const emptyState   = el('div', { class: 'empty-state hidden' },
    el('p', {}, '😕 Nenhum fornecedor encontrado.')
  )

  mount(container, toolbar, searchInput, tableWrapper, emptyState)

  function renderRows(list) {
    countBadge.textContent = list.length
    tbody.replaceChildren()

    if (!list.length) {
      tableWrapper.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }

    tableWrapper.classList.remove('hidden')
    emptyState.classList.add('hidden')

    for (const f of list) {
      const typeBadge = el('span', { class: `badge badge-${f.type}` },
        f.type === 'pf' ? 'PF' : 'PJ')

      const country = findCountryByDial(f.phoneCountry || '55')
      const phoneText = f.phone
        ? `${country.dial !== '55' ? `+${country.dial} ` : ''}${maskPhoneForCountry(f.phone, country)}`
        : ''
      const phoneCell = el('td', {}, phoneText)
      const waLink = whatsappLink(f.phone, f.phoneCountry)
      if (waLink) {
        const waAnchor = el('a', { href: waLink, target: '_blank', rel: 'noopener', class: 'whatsapp-link', title: 'Abrir WhatsApp' }, whatsappIcon())
        phoneCell.appendChild(waAnchor)
      }

      const categoriasText = (f.categorias || []).map(c => CATEGORIA_LABELS[c] || c).join(', ')
      const categoriasCell = el('td', {}, categoriasText || '—')

      const comunidadeCell = f.comunidade
        ? el('td', { class: 'col-center' }, el('span', { class: 'badge badge-comunidade', title: 'Está na comunidade que envia lista diária de aparelhos' }, 'Sim'))
        : el('td', { class: 'col-center' }, el('span', { class: 'badge badge-validation-expired' }, 'Não'))

      const { status } = validationStatus(f.lastValidatedAt)
      const validationBadge = el('span', { class: `badge badge-validation-${status}` }, VALIDATION_LABELS[status])

      const nameCell = el('td', { class: 'td-name' }, f.name)
      if (status === 'ok') {
        nameCell.appendChild(el('img', {
          src: `${import.meta.env.BASE_URL}verified-badge.png`,
          class: 'verified-badge',
          title: 'Fornecedor validado',
          alt: 'Validado',
        }))
      }

      const cells = [
        nameCell,
        el('td', {}, typeBadge),
        phoneCell,
        categoriasCell,
        comunidadeCell,
        el('td', {}, validationBadge),
        el('td', {}, f.box || '—'),
      ]

      if (canEdit || canDelete) {
        cells.push(el('td', { class: 'col-actions' }, renderRowActions({
          canEdit, canDelete,
          onEdit: () => openFornecedorModal(f),
          onDelete: () => confirmDelete(f),
        })))
      }

      tbody.appendChild(el('tr', {}, ...cells))
    }
  }

  let allFornecedores = fornecedores

  function applyFilterAndSort() {
    const q = searchInput.value.toLowerCase()
    const qDigits = q.replace(/\D/g, '')
    const filtered = allFornecedores.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.box || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q) ||
      (f.vendedor || '').toLowerCase().includes(q) ||
      (f.document || '').includes(qDigits) ||
      (f.phone || '').includes(qDigits)
    )
    filtered.sort((a, b) => {
      const va = sortValue(a, sortCol)
      const vb = sortValue(b, sortCol)
      let cmp
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    renderRows(filtered)
  }

  applyFilterAndSort()

  searchInput.addEventListener('input', applyFilterAndSort)

  return {
    update(newList) {
      allFornecedores = newList
      searchInput.dispatchEvent(new Event('input'))
    },
  }
}

function openFornecedorModal(fornecedor) {
  openModal({
    title: fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor',
    size: 'lg',
    renderBody: (body, close) => {
      renderFornecedorForm(body, close, fornecedor)
    },
  })
}

function confirmDelete(fornecedor) {
  openConfirm({
    title: 'Excluir fornecedor',
    message: `Deseja excluir "${fornecedor.name}"? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Excluir',
    danger: true,
    onConfirm: async () => {
      try {
        await deleteFornecedor(fornecedor.id)
        toastSuccess('Fornecedor excluído.')
      } catch {
        toastError('Erro ao excluir. Tente novamente.')
      }
    },
  })
}
