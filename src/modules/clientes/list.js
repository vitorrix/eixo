import { el, mount } from '../../shared/utils/dom.js'
import { can } from '../../auth/session.js'
import { maskCPF, maskCNPJ, maskPhone } from '../../shared/utils/formatters.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastError, toastSuccess } from '../../shared/components/Toast.js'
import { deleteCliente } from './service.js'
import { renderClienteForm } from './form.js'

export function renderClienteList(container, clientes) {
  const canCreate = can('clientes', 'create')
  const canEdit   = can('clientes', 'edit')
  const canDelete = can('clientes', 'delete')

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const searchInput = el('input', {
    type: 'search',
    class: 'search-input',
    placeholder: 'Buscar por nome, documento ou e-mail...',
  })

  const countBadge = el('span', { class: 'count-badge' }, `${clientes.length}`)
  const title = el('h2', {}, 'Clientes ', countBadge)

  const toolbar = el('div', { class: 'toolbar' }, title)

  if (canCreate) {
    const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo Cliente')
    addBtn.addEventListener('click', () => openClienteModal(null))
    toolbar.appendChild(addBtn)
  }

  // ── Tabela ───────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Nome'),
        el('th', {}, 'Tipo'),
        el('th', {}, 'Documento'),
        el('th', {}, 'Telefone'),
        el('th', {}, 'E-mail'),
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, 'Ações')] : [])
      )
    ),
    tbody
  )

  const tableWrapper = el('div', { class: 'table-wrapper' }, table)
  const emptyState   = el('div', { class: 'empty-state hidden' },
    el('p', {}, '😕 Nenhum cliente encontrado.')
  )

  mount(container, toolbar, searchInput, tableWrapper, emptyState)

  // ── Renderizar linhas ─────────────────────────────────────────────────
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

    for (const c of list) {
      const docFormatted = c.type === 'pf'
        ? maskCPF(c.document)
        : maskCNPJ(c.document)

      const typeBadge = el('span', {
        class: `badge badge-${c.type}`,
      }, c.type === 'pf' ? 'PF' : 'PJ')

      const cells = [
        el('td', { class: 'td-name' }, c.name),
        el('td', {}, typeBadge),
        el('td', {}, docFormatted),
        el('td', {}, maskPhone(c.phone)),
        el('td', {}, c.email),
      ]

      if (canEdit || canDelete) {
        const actions = el('td', { class: 'td-actions' })
        if (canEdit) {
          const editBtn = el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, 'Editar')
          editBtn.addEventListener('click', () => openClienteModal(c))
          actions.appendChild(editBtn)
        }
        if (canDelete) {
          const delBtn = el('button', { class: 'btn btn-sm btn-danger-outline', type: 'button' }, 'Excluir')
          delBtn.addEventListener('click', () => confirmDelete(c))
          actions.appendChild(delBtn)
        }
        cells.push(actions)
      }

      tbody.appendChild(el('tr', {}, ...cells))
    }
  }

  // ── Busca client-side ─────────────────────────────────────────────────
  let allClientes = clientes
  renderRows(allClientes)

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().replace(/\D/g, '')
    const qText = searchInput.value.toLowerCase()
    const filtered = allClientes.filter(c =>
      c.name.toLowerCase().includes(qText) ||
      c.email.toLowerCase().includes(qText) ||
      c.document.includes(q) ||
      c.phone.includes(q)
    )
    renderRows(filtered)
  })

  // ── Expor atualização de dados (chamada pelo subscribeClientes) ────────
  return {
    update(newList) {
      allClientes = newList
      // Reaplicar filtro atual ao receber novos dados
      searchInput.dispatchEvent(new Event('input'))
    },
  }
}

// ── Modal de criação / edição ──────────────────────────────────────────────
function openClienteModal(cliente) {
  openModal({
    title: cliente ? 'Editar Cliente' : 'Novo Cliente',
    size: 'lg',
    renderBody: (body, close) => {
      renderClienteForm(body, close, cliente)
    },
  })
}

// ── Confirmação de exclusão ───────────────────────────────────────────────
function confirmDelete(cliente) {
  openConfirm({
    title: 'Excluir cliente',
    message: `Deseja excluir "${cliente.name}"? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Excluir',
    danger: true,
    onConfirm: async () => {
      try {
        await deleteCliente(cliente.id)
        toastSuccess('Cliente excluído.')
      } catch {
        toastError('Erro ao excluir. Tente novamente.')
      }
    },
  })
}
