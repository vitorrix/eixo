import { el, mount } from '../../shared/utils/dom.js'
import { can } from '../../auth/session.js'
import { rawDigits } from '../../shared/utils/formatters.js'
import { findCountryByDial, maskPhoneForCountry } from '../../shared/utils/countries.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastError, toastSuccess } from '../../shared/components/Toast.js'
import { deleteFornecedor } from './service.js'
import { renderFornecedorForm } from './form.js'
import { validationStatus, VALIDATION_LABELS } from './validation.js'

const CATEGORIA_LABELS = { apple: 'Apple', android: 'Android', seminovo: 'S/N', acessorios: 'Acessórios' }

function whatsappLink(phone, phoneCountry) {
  const digits = rawDigits(phone || '')
  if (!digits) return null
  const dial = phoneCountry || '55'
  const msg = encodeURIComponent('Olá! Aqui é da Baruk Technology.')
  return `https://wa.me/${dial}${digits}?text=${msg}`
}

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

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Nome'),
        el('th', {}, 'Tipo'),
        el('th', {}, 'Telefone'),
        el('th', {}, 'Categorias'),
        el('th', { class: 'col-center' }, 'Comunidade'),
        el('th', {}, 'Validação'),
        el('th', {}, 'Box / Galeria'),
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
        const waAnchor = el('a', { href: waLink, target: '_blank', rel: 'noopener', class: 'whatsapp-link', title: 'Abrir WhatsApp' }, ' WhatsApp')
        phoneCell.appendChild(waAnchor)
      }

      const categoriasText = (f.categorias || []).map(c => CATEGORIA_LABELS[c] || c).join(', ')
      const categoriasCell = el('td', {}, categoriasText || '—')

      const comunidadeCell = f.comunidade
        ? el('td', { class: 'col-center' }, el('span', { class: 'badge badge-comunidade', title: 'Está na comunidade que envia lista diária de aparelhos' }, 'Sim'))
        : el('td', { class: 'col-center' }, el('span', { class: 'badge badge-validation-expired' }, 'Não'))

      const { status } = validationStatus(f.lastValidatedAt)
      const validationBadge = el('span', { class: `badge badge-validation-${status}` }, VALIDATION_LABELS[status])

      const cells = [
        el('td', { class: 'td-name' }, f.name),
        el('td', {}, typeBadge),
        phoneCell,
        categoriasCell,
        comunidadeCell,
        el('td', {}, validationBadge),
        el('td', {}, f.box || '—'),
      ]

      if (canEdit || canDelete) {
        const actions = el('td', { class: 'td-actions' })
        if (canEdit) {
          const editBtn = el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, 'Editar')
          editBtn.addEventListener('click', () => openFornecedorModal(f))
          actions.appendChild(editBtn)
        }
        if (canDelete) {
          const delBtn = el('button', { class: 'btn btn-sm btn-danger-outline', type: 'button' }, 'Excluir')
          delBtn.addEventListener('click', () => confirmDelete(f))
          actions.appendChild(delBtn)
        }
        cells.push(actions)
      }

      tbody.appendChild(el('tr', {}, ...cells))
    }
  }

  let allFornecedores = fornecedores
  renderRows(allFornecedores)

  searchInput.addEventListener('input', () => {
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
    renderRows(filtered)
  })

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
