import { el, mount } from '../../shared/utils/dom.js'
import { toolbarCard, searchWithIcon, toolbarMeta } from '../../shared/components/ToolbarCard.js'
import { can } from '../../auth/session.js'
import { maskCPF, maskCNPJ, maskPhone } from '../../shared/utils/formatters.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { toastError, toastSuccess } from '../../shared/components/Toast.js'
import { createSortableHead } from '../../shared/components/SortableHead.js'
import { deleteCliente, importarClientes, deletarClientes } from './service.js'
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

  const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Novo Cliente')
  addBtn.style.display = canCreate ? '' : 'none'
  addBtn.addEventListener('click', () => openClienteModal(null))

  // ── Importar XLS ──────────────────────────────────────────────────────────
  const xlsInput = el('input', { type: 'file', accept: '.xlsx,.xls,.csv', style: 'display:none' })
  const importBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '↑ Importar XLS')
  importBtn.style.display = canCreate ? '' : 'none'
  importBtn.addEventListener('click', () => xlsInput.click())

  async function executarImport(validos, substituir) {
    importBtn.disabled = true
    importBtn.textContent = substituir ? 'Apagando...' : 'Importando...'
    try {
      if (substituir && clientes.length) {
        await deletarClientes(clientes.map(c => c.id))
      }
      importBtn.textContent = 'Importando...'
      await importarClientes(validos)
      toastSuccess(`${validos.length} cliente(s) importado(s) com sucesso.`)
    } catch (err) {
      console.error(err)
      toastError('Erro ao importar arquivo.')
    } finally {
      importBtn.disabled = false
      importBtn.textContent = '↑ Importar XLS'
    }
  }

  xlsInput.addEventListener('change', async () => {
    const file = xlsInput.files?.[0]
    if (!file) return
    xlsInput.value = ''
    try {
      const { read, utils } = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = utils.sheet_to_json(ws, { defval: '' })
      const validos = rows.filter(r => String(r.nome || '').trim())
      if (!validos.length) {
        toastError('Nenhuma linha válida encontrada (coluna "nome" obrigatória).')
        return
      }

      if (!clientes.length) {
        await executarImport(validos, false)
        return
      }

      openModal({
        title: 'Importar clientes',
        size: 'sm',
        renderBody: (body, closeModal) => {
          body.append(
            el('p', { style: 'margin-bottom:8px;font-size:14px' },
              `O arquivo contém ${validos.length} cliente(s).`),
            el('p', { style: 'margin-bottom:20px;font-size:14px;color:var(--color-muted)' },
              `Há ${clientes.length} cliente(s) já cadastrados.`),
            el('div', { style: 'display:flex;flex-direction:column;gap:10px' },
              (() => {
                const btn = el('button', { type: 'button', class: 'btn btn-outline', style: 'text-align:left;padding:12px 16px' },
                  el('strong', {}, 'Adicionar à lista'),
                  el('br', {}),
                  el('span', { style: 'font-size:12px;color:var(--color-muted)' },
                    'Mantém os clientes existentes e insere os novos.')
                )
                btn.addEventListener('click', async () => { closeModal(); await executarImport(validos, false) })
                return btn
              })(),
              (() => {
                const btn = el('button', { type: 'button', class: 'btn btn-danger-outline', style: 'text-align:left;padding:12px 16px' },
                  el('strong', {}, 'Substituir tudo'),
                  el('br', {}),
                  el('span', { style: 'font-size:12px' },
                    `Apaga os ${clientes.length} cliente(s) e importa só o arquivo.`)
                )
                btn.addEventListener('click', async () => { closeModal(); await executarImport(validos, true) })
                return btn
              })()
            )
          )
        },
      })
    } catch (err) {
      console.error(err)
      toastError('Erro ao ler o arquivo.')
    }
  })

  const toolbar = toolbarCard(
    el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, addBtn, importBtn, xlsInput),
    searchWithIcon(searchInput),
    toolbarMeta(countBadge),
  )

  // ── Tabela ───────────────────────────────────────────────────────────────
  const sortHead = createSortableHead([
    { key: 'nome',      label: 'Nome' },
    { key: 'tipo',      label: 'Tipo' },
    { key: 'documento', label: 'Documento' },
    { key: 'telefone',  label: 'Telefone' },
    { key: 'email',     label: 'E-mail' },
    ...(canEdit || canDelete ? [{ key: null, label: 'Ações', cls: 'col-actions' }] : []),
  ], {
    initialCol: 'nome',
    initialDir: 'asc',
    sortValue: (c, key) => {
      switch (key) {
        case 'nome':      return c.name || ''
        case 'tipo':      return c.type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'
        case 'documento': return c.document || ''
        case 'telefone':  return (c.phone || '').replace(/\D/g, '').padStart(15, '0')
        case 'email':     return c.email || ''
        default:          return ''
      }
    },
    onSort: () => applyFilterAndSort(),
  })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {}, ...sortHead.ths)
    ),
    tbody
  )

  const tableWrapper = el('div', { class: 'table-wrapper' }, table)
  const emptyState   = el('div', { class: 'empty-state hidden' },
    el('p', {}, '😕 Nenhum cliente encontrado.')
  )

  mount(container, toolbar, tableWrapper, emptyState)

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
        el('td', { class: 'td-name', title: c.name || '' }, c.name),
        el('td', {}, typeBadge),
        el('td', {}, docFormatted),
        el('td', {}, maskPhone(c.phone)),
        el('td', {}, c.email),
      ]

      if (canEdit || canDelete) {
        cells.push(el('td', { class: 'col-actions' }, renderRowActions({
          canEdit, canDelete,
          onEdit: () => openClienteModal(c),
          onDelete: () => confirmDelete(c),
        })))
      }

      tbody.appendChild(el('tr', {}, ...cells))
    }
  }

  // ── Busca client-side ─────────────────────────────────────────────────
  let allClientes = clientes

  function applyFilterAndSort() {
    const qText   = searchInput.value.toLowerCase().trim()
    const qDigits = qText.replace(/\D/g, '')
    const filtered = qText
      ? allClientes.filter(c =>
          c.name.toLowerCase().includes(qText) ||
          c.email.toLowerCase().includes(qText) ||
          (qDigits && (c.document.includes(qDigits) || c.phone.includes(qDigits)))
        )
      : allClientes
    renderRows(sortHead.sort(filtered))
  }
  applyFilterAndSort()

  searchInput.addEventListener('input', applyFilterAndSort)

  // ── Expor atualização de dados (chamada pelo subscribeClientes) ────────
  return {
    update(newList) {
      clientes = newList
      allClientes = newList
      applyFilterAndSort()
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
