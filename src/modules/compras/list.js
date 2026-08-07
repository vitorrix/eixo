import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate, toNumero } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { createChipSelect } from '../../shared/components/ChipSelect.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { createComprasEmLote, atualizarStatusCompra, updateCompra, updateCompraItens, deleteCompra } from './service.js'
import { createClienteRapido } from '../clientes/service.js'
import { abrirDetalhesModal, tornarLinhaClicavel } from '../../shared/components/DetalhesModal.js'
import { createSortableHead } from '../../shared/components/SortableHead.js'
import { createFullPageSwitcher } from '../../shared/components/FullPageForm.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { toolbarCard, searchWithIcon, toolbarMeta } from '../../shared/components/ToolbarCard.js'
import { presetRange } from '../../shared/utils/periodo.js'

const STATUS_META = {
  aguardando: { label: 'Aguardando', cls: 'badge-aguardando' },
  estoque:    { label: 'Estoque',    cls: 'badge-estoque'    },
  concluido:  { label: 'Concluído',  cls: 'badge-concluido'  },
}

// Aguardando: gerado pelo fluxo de Pedidos (compra pro fornecedor ou troca do
// cliente) enquanto o pedido não é marcado como entregue — nasce assim, nunca
// escolhido manualmente. Estoque: unidade disponível pra vender/puxar em outro
// pedido (compra avulsa já nasce aqui; troca vira isso quando o pedido é
// entregue). Concluído: não tem mais nada a fazer — foi vendido, ou (sem
// troca) foi direto pro cliente do próprio pedido que gerou a compra.
const STATUS_ORDER = ['aguardando', 'estoque', 'concluido']

// Data local (não UTC) do Timestamp — pra comparar com o range do period picker.
function dataLocal(ts) {
  if (!ts?.toDate) return ''
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Compra de nota com 1 produto só mostra o nome; nota com vários (itens[])
// mostra o primeiro + quantos a mais, igual ao resumo de Vendas.
function compraProdutoResumo(c) {
  if (Array.isArray(c.itens) && c.itens.length) {
    const [first, ...resto] = c.itens
    return resto.length ? `${first.produto} +${resto.length}` : first.produto
  }
  return c.produto || '—'
}

// Editor de itens (Produto/Custo unitário/Quantidade/Total, com + Adicionar
// item e × por linha) — usado igual na Nova Compra e na Editar Compra, pra
// corrigir produto/custo/quantidade sem precisar excluir e relançar.
// "custoUnit" no estado é o preço unitário; quem grava (createComprasEmLote/
// updateCompraItens) espera o total da linha (unitário × quantidade).
function criarEditorItens(produtoNomes, produtosCatalogo, itensIniciais) {
  let itens = itensIniciais.map(it => ({ ...it }))
  const itensWrap = el('div', { class: 'produtos-wrap' })

  function renderItens() {
    itensWrap.replaceChildren()

    itens.forEach((it, i) => {
      const itemProdutoAc = createAutocomplete({
        placeholder:  'Produto do catálogo',
        items:        produtoNomes,
        initialValue: it.produto,
        onSelect:     v => {
          itens[i].produto = v
          itens[i].produtoId = produtosCatalogo.find(p => p.nome === v)?.id || null
        },
      })
      itemProdutoAc.el.style.width = '100%'
      itemProdutoAc.el.addEventListener('input', () => {
        itens[i].produto = itemProdutoAc.getValue()
        itens[i].produtoId = produtosCatalogo.find(p => p.nome === itemProdutoAc.getValue())?.id || null
      })

      const custoUnitInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
      custoUnitInp.value = it.custoUnit
      const qtdInp = el('input', { type: 'number', step: '1', min: '1', placeholder: '1' })
      qtdInp.value = it.quantidade
      const totalSpan = el('span', {}, brl(0))

      function updateRowTotal() {
        const total = (parseFloat(custoUnitInp.value) || 0) * (parseInt(qtdInp.value) || 1)
        totalSpan.textContent = brl(total)
      }
      custoUnitInp.addEventListener('input', () => { itens[i].custoUnit = custoUnitInp.value; updateRowTotal() })
      qtdInp.addEventListener('input', () => { itens[i].quantidade = qtdInp.value; updateRowTotal() })
      updateRowTotal()

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => {
        if (itens.length === 1) return
        itens.splice(i, 1); renderItens()
      })

      itensWrap.appendChild(
        el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, `Item ${i + 1}`),
            delBtn
          ),
          el('div', { class: 'form-produto-row3' },
            el('div', { class: 'field field-grow' }, el('label', {}, 'Produto'), itemProdutoAc.el),
            el('div', { class: 'field' }, el('label', {}, 'Custo unitário R$'), custoUnitInp),
            el('div', { class: 'field' }, el('label', {}, 'Quantidade'), qtdInp),
          ),
          el('div', { class: 'text-muted', style: 'text-align:right;font-size:13px;margin-top:6px' },
            'Total: ', totalSpan)
        )
      )
    })
  }
  renderItens()

  const addItemBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar item')
  addItemBtn.addEventListener('click', () => {
    itens.push({ produtoId: null, produto: '', custoUnit: '', quantidade: 1 })
    renderItens()
  })

  return { itensWrap, addItemBtn, getItens: () => itens }
}

export function renderComprasList(container, compras, { fornecedores, produtosCatalogo, clientes, formasPagamento }) {
  let clientesList = [...clientes]
  const canCreate = can('compras', 'create')
  const canEdit   = can('compras', 'edit')
  const canDelete = can('compras', 'delete')

  let periodo = presetRange('este-mes')

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEl      = el('div', { class: 'pedido-stat-value' })
  const custoEl      = el('div', { class: 'pedido-stat-value' })
  const aguardEl     = el('div', { class: 'pedido-stat-value red' })
  const estoqueEl    = el('div', { class: 'pedido-stat-value green' })

  function updateKpis(list) {
    totalEl.textContent   = list.length
    custoEl.textContent   = brl(list.reduce((s, c) => s + toNumero(c.custo), 0))
    aguardEl.textContent  = list.filter(c => c.status === 'aguardando').length
    estoqueEl.textContent = list.filter(c => c.status === 'estoque').length
    aguardEl.className    = 'pedido-stat-value ' + (aguardEl.textContent > 0 ? 'red' : 'green')
  }

  function kpiCard(label, valueEl, sub) {
    return el('div', { class: 'pedido-stat' },
      el('div', { class: 'pedido-stat-label' }, label),
      valueEl,
      el('div', { class: 'pedido-stat-sub' }, sub)
    )
  }

  const kpisRow = el('div', { class: 'pedidos-stats' },
    kpiCard('Compras',    totalEl,   'no período'),
    kpiCard('Custo Total', custoEl,   'no período'),
    kpiCard('Aguardando', aguardEl,  'trocas em andamento'),
    kpiCard('Em Estoque', estoqueEl, 'disponível'),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input',
    placeholder: 'Buscar por produto, fornecedor ou cliente...' })
  searchInp.addEventListener('input', () => refresh())

  const picker = createPeriodoPicker({
    initialPreset: 'este-mes',
    onChange: p => { periodo = p; refresh() },
  })

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Nova Compra')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => abrirNovaCompraModal())

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = toolbarCard(newBtn, searchWithIcon(searchInp), toolbarMeta(picker.el, countBadge))

  // ── Tabela ─────────────────────────────────────────────────────────────────
  const sortHead = createSortableHead([
    { key: 'data',       label: 'Data' },
    { key: 'cliente',    label: 'Cliente' },
    { key: 'produto',    label: 'Produto' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'custo',      label: 'Custo', cls: 'th-money' },
    { key: 'status',     label: 'Status' },
  ], {
    initialCol: 'data',
    initialDir: 'desc',
    sortValue: (c, key) => {
      switch (key) {
        case 'data':       return c.criadoEm?.toDate ? c.criadoEm.toDate().getTime() : 0
        case 'cliente':    return c.cliente || ''
        case 'produto':    return compraProdutoResumo(c)
        case 'fornecedor': return c.fornecedor || ''
        case 'custo':      return toNumero(c.custo)
        case 'status':     return c.status || ''
        default:           return ''
      }
    },
    onSort: () => refresh(),
  })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {}, ...sortHead.ths,
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, '')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhuma compra no período.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      'As compras são geradas ao confirmar o pagamento de um pedido.')
  )

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = compras.filter(c => {
      const d = dataLocal(c.criadoEm)
      return d && d >= periodo.de && d <= periodo.ate
    })
    if (q) list = list.filter(c =>
      (c.produto || '').toLowerCase().includes(q) ||
      (c.fornecedor || '').toLowerCase().includes(q) ||
      (c.cliente || '').toLowerCase().includes(q)
    )
    return sortHead.sort(list)
  }

  function refresh() {
    const list = filteredList()
    countBadge.textContent = list.length
    updateKpis(list)
    renderTable(list)
  }

  function renderTable(list) {
    tbody.replaceChildren()
    if (!list.length) {
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')

    for (const c of list) {
      const meta = STATUS_META[c.status] || { label: c.status, cls: 'badge-aguardando' }

      // Inline status select
      const statusSel = el('select', { class: `status-inline-sel ${meta.cls}` })
      STATUS_ORDER.forEach(s => {
        const opt = el('option', { value: s }, STATUS_META[s]?.label || s)
        if (s === c.status) opt.selected = true
        statusSel.appendChild(opt)
      })
      statusSel.addEventListener('change', async () => {
        const prev = statusSel.className
        statusSel.className = `status-inline-sel ${STATUS_META[statusSel.value]?.cls || ''}`
        try {
          await atualizarStatusCompra(c, statusSel.value)
          toastSuccess(
            statusSel.value === 'estoque' && !c.pedidoId && c.produtoId
              ? 'Status atualizado. Estoque atualizado.'
              : 'Status atualizado.'
          )
        } catch {
          toastError('Erro ao atualizar.')
          statusSel.value = c.status
          statusSel.className = prev
        }
      })

      // Ações
      const actionsCell = el('td', { class: 'col-actions' }, renderRowActions({
        canEdit, canDelete,
        onEdit: () => openEditModal(c),
        onDelete: () => confirmDelete(c),
      }))

      const dateStr = c.criadoEm?.toDate ? shortDate(c.criadoEm.toDate().toISOString().slice(0,10)) : '—'

      const row = el('tr', {},
        el('td', { class: 'td-date' }, dateStr),
        el('td', {}, c.cliente || '—'),
        el('td', { class: 'td-name', title: compraProdutoResumo(c) }, compraProdutoResumo(c)),
        el('td', {}, c.fornecedor || '—'),
        el('td', { class: 'td-money' }, brl(toNumero(c.custo))),
        el('td', {}, statusSel),
        ...(canEdit || canDelete ? [actionsCell] : []),
      )
      tornarLinhaClicavel(row, () => abrirDetalhesCompraModal(c))
      tbody.appendChild(row)
    }
  }

  // ── Detalhes (consulta) ──────────────────────────────────────────────────
  function abrirDetalhesCompraModal(c) {
    const meta = STATUS_META[c.status] || { label: c.status || '—' }
    const temItens = Array.isArray(c.itens) && c.itens.length
    abrirDetalhesModal({
      title: 'Detalhes da Compra',
      campos: [
        ['Cliente', c.cliente],
        temItens
          ? ['Itens', c.itens.map(i => `${i.produto} (${i.quantidade}x ${brl(toNumero(i.custo))})`).join(' · ')]
          : ['Produto', c.produto],
        !temItens && c.quantidade > 1 ? ['Quantidade', String(c.quantidade)] : null,
        ['Fornecedor', c.fornecedor],
        ['Custo', brl(toNumero(c.custo))],
        ['Status', meta.label],
        c.observacoes ? ['Dados do aparelho', c.observacoes] : null,
      ],
      onEditar: canEdit ? () => openEditModal(c) : null,
    })
  }

  function abrirNovaCompraModal() {
    const produtoNomes = produtosCatalogo.map(p => p.nome)

    pageSwitch.showForm('Nova Compra',
      (body, closeModal) => {
        // Fornecedor OU cliente — muitas compras (principalmente semi-novo) são
        // feitas direto de um cliente, não de um fornecedor cadastrado. Se o
        // texto bater com um cliente da lista, a compra grava em "cliente" em
        // vez de "fornecedor"; se não achar ninguém, o cadastro rápido sempre
        // cria um CLIENTE (fornecedor já teria que estar cadastrado no menu
        // Fornecedores antes de aparecer aqui).
        function nomesFornecedorOuCliente() {
          return [
            ...fornecedores.map(f => f.box ? `${f.name} - ${f.box}` : f.name),
            ...clientesList.map(c => c.name),
          ]
        }

        let clienteSelecionado = null
        function atualizarClienteSelecionado() {
          clienteSelecionado = clientesList.find(c => c.name === fornAc.getValue()) || null
        }

        function abrirCadastroRapidoCliente(nomeInicial) {
          openModal({
            title: 'Novo cliente',
            size: 'sm',
            renderBody: (body2, closeModal2) => {
              let tipo = 'PF'
              const pfBtn = el('button', { type: 'button', class: 'type-btn active' }, 'PF')
              const pjBtn = el('button', { type: 'button', class: 'type-btn' }, 'PJ')
              pfBtn.addEventListener('click', () => { tipo = 'PF'; pfBtn.classList.add('active'); pjBtn.classList.remove('active') })
              pjBtn.addEventListener('click', () => { tipo = 'PJ'; pjBtn.classList.add('active'); pfBtn.classList.remove('active') })

              const nomeInp = el('input', { type: 'text', placeholder: 'Nome completo' })
              nomeInp.value = nomeInicial
              const foneInp = el('input', { type: 'tel', placeholder: '(00) 00000-0000' })
              const cancelarBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
              cancelarBtn.addEventListener('click', closeModal2)

              const salvarBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Cadastrar')
              salvarBtn.addEventListener('click', async () => {
                const nome = nomeInp.value.trim()
                if (!nome) { toastError('Informe o nome do cliente.'); return }
                salvarBtn.disabled = true; salvarBtn.textContent = 'Salvando...'
                try {
                  const docRef = await createClienteRapido(nome, foneInp.value, tipo)
                  clientesList.push({ id: docRef.id, name: nome, nameLower: nome.toLowerCase() })
                  clientesList.sort((a, b) => a.nameLower.localeCompare(b.nameLower))
                  fornAc.setItems(nomesFornecedorOuCliente())
                  fornAc.setValue(nome)
                  atualizarClienteSelecionado()
                  toastSuccess(`"${nome}" cadastrado.`)
                  closeModal2()
                } catch (err) {
                  console.error(err)
                  toastError('Erro ao cadastrar cliente.')
                  salvarBtn.disabled = false; salvarBtn.textContent = 'Cadastrar'
                }
              })

              body2.append(
                el('div', { class: 'type-toggle', style: 'margin-bottom:16px' }, pfBtn, pjBtn),
                el('div', { class: 'field', style: 'margin-bottom:12px' }, el('label', {}, 'Nome'), nomeInp),
                el('div', { class: 'field', style: 'margin-bottom:20px' }, el('label', {}, 'Telefone'), foneInp),
                el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, cancelarBtn, salvarBtn)
              )
              setTimeout(() => nomeInp.focus(), 50)
            },
          })
        }

        const fornAc = createAutocomplete({
          placeholder: 'Fornecedor ou cliente',
          items:       nomesFornecedorOuCliente(),
          onSelect:    atualizarClienteSelecionado,
          extraOption: {
            getLabel: q => `+ Cadastrar "${q}" como novo cliente`,
            action:   q => abrirCadastroRapidoCliente(q),
          },
        })
        fornAc.el.style.width = '100%'
        fornAc.el.addEventListener('input', atualizarClienteSelecionado)

        // "Aguardando" não aparece aqui — só nasce do fluxo de Pedidos (esperando
        // troca/entrega). Lançamento manual já é uma compra fechada: ou vai pro
        // estoque (padrão), ou já nasce concluída (raro, mas possível). Mesmo
        // select colorido (status-inline-sel) já usado na linha da tabela.
        const statusSelNew = el('select', { class: `status-inline-sel ${STATUS_META.estoque.cls}` })
        ;['estoque', 'concluido'].forEach(s => statusSelNew.appendChild(el('option', { value: s }, STATUS_META[s]?.label || s)))
        statusSelNew.value = 'estoque'
        statusSelNew.addEventListener('change', () => {
          statusSelNew.className = `status-inline-sel ${STATUS_META[statusSelNew.value]?.cls || ''}`
        })

        // Compra lançada aqui já nasce paga (não existe "aguardando" nesse
        // formulário) — a forma de pagamento gera o Pagamento no Financeiro
        // junto com a Compra, sem precisar lançar os dois separado.
        const pagChips = createChipSelect(formasPagamento.map(f => f.nome), { value: formasPagamento[0]?.nome || '' })

        const aparelhoInp = el('textarea', { rows: '3', class: 'field-textarea',
          placeholder: 'Specs, serial, IMEI... (se já souber — aparece no recibo do cliente; deixe em branco pra lote sem serial, ex: acessório)' })

        // ── Itens da compra — 1 fornecedor, N produtos (ex: acessório comprado
        // em lote, cada um com seu custo unitário e quantidade). 1 item só vira
        // Compra no formato de sempre; 2+ itens viram UMA Compra com "itens[]"
        // (mesma nota, mesmo fornecedor).
        const { itensWrap, addItemBtn, getItens } = criarEditorItens(
          produtoNomes, produtosCatalogo,
          [{ produtoId: null, produto: '', custoUnit: '', quantidade: 1 }]
        )

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', closeModal)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Criar compra')
        okBtn.addEventListener('click', async () => {
          const validos = getItens().filter(it => it.produto.trim())
          if (!validos.length) { toastError('Adicione ao menos um produto.'); return }
          okBtn.disabled = true
          try {
            await createComprasEmLote(
              {
                fornecedor:  clienteSelecionado ? '' : fornAc.getValue(),
                cliente:     clienteSelecionado ? clienteSelecionado.name : '',
                status:      statusSelNew.value,
                observacoes: aparelhoInp.value,
                formaPagamento: pagChips.getValue(),
              },
              validos.map(it => ({
                produtoId:  it.produtoId,
                produto:    it.produto.trim(),
                quantidade: it.quantidade,
                custo:      (parseFloat(it.custoUnit) || 0) * (parseInt(it.quantidade) || 1),
              }))
            )
            toastSuccess('Compra criada.')
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao criar compra.')
            okBtn.disabled = false
          }
        })

        mount(body,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Fornecedor ou cliente'), fornAc.el),
          ),
          el('div', { class: 'form-produto-header' },
            el('p', { class: 'form-sub-label' }, 'Itens'),
            addItemBtn
          ),
          itensWrap,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field' }, el('label', {}, 'Status'), statusSelNew),
            el('div', { class: 'field field-full' }, el('label', {}, 'Forma de pagamento'), pagChips.el),
            el('div', { class: 'field field-full' }, el('label', {}, 'Dados do aparelho'), aparelhoInp),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      })
  }

  // Compra gerada por um Pedido é 1 aparelho/serviço só, sem produto de
  // catálogo — edição fica simples (Fornecedor/Custo/Dados do aparelho), igual
  // sempre foi. Compra lançada direto no menu (sem pedidoId) usa o mesmo
  // editor de itens da Nova Compra, pra poder corrigir produto/custo/
  // quantidade sem excluir e relançar.
  function openEditModal(compra) {
    return compra.pedidoId ? openEditModalPedido(compra) : openEditModalItens(compra)
  }

  function openEditModalPedido(compra) {
    pageSwitch.showForm('Editar Compra',
      (body, close) => {
        const dl = el('datalist', { id: 'ce-forn-list' })
        fornecedores.forEach(f => dl.appendChild(el('option', { value: f.name })))

        const fornInp  = el('input', { type: 'text', list: 'ce-forn-list', placeholder: 'Fornecedor' })
        fornInp.value  = compra.fornecedor || ''

        const custoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
        custoInp.value = compra.custo || ''

        const aparelhoInp = el('textarea', { rows: '3', class: 'field-textarea',
          placeholder: 'Specs, serial, IMEI... (aparece no recibo do cliente)' })
        aparelhoInp.value = compra.observacoes || ''

        // Produto vem do item do Pedido que gerou essa Compra — travado aqui:
        // mudar o texto por conta própria desalinharia com a Venda/recibo, que
        // usam o mesmo texto pra casar item ↔ custo (relatorios/vendasCalc.js).
        // Quem quiser trocar o produto edita o Pedido, não a Compra.
        const produtoLockedInp = el('input', { type: 'text', disabled: true })
        produtoLockedInp.value = compra.produto || ''

        const itemBlock = el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, 'Item 1'),
          ),
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Produto (vem do Pedido)'), produtoLockedInp),
            el('div', { class: 'field' }, el('label', {}, 'Custo R$'), custoInp),
          ),
        )

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', close)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')
        okBtn.addEventListener('click', async () => {
          okBtn.disabled = true
          try {
            await updateCompra(compra.id, { fornecedor: fornInp.value, custo: custoInp.value, observacoes: aparelhoInp.value })
            toastSuccess('Compra atualizada.'); close()
          } catch {
            toastError('Erro ao salvar.')
            okBtn.disabled = false
          }
        })

        mount(body,
          dl,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Fornecedor'), fornInp),
          ),
          el('div', { class: 'form-produto-header' },
            el('p', { class: 'form-sub-label' }, 'Itens'),
          ),
          itemBlock,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Dados do aparelho'), aparelhoInp),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      })
  }

  function openEditModalItens(compra) {
    const produtoNomes = produtosCatalogo.map(p => p.nome)
    const itensIniciais = (Array.isArray(compra.itens) && compra.itens.length
      ? compra.itens
      : [{ produtoId: compra.produtoId || null, produto: compra.produto || '', quantidade: compra.quantidade || 1, custo: compra.custo || 0 }]
    ).map(it => ({
      produtoId:  it.produtoId || null,
      produto:    it.produto || '',
      custoUnit:  it.quantidade ? (it.custo || 0) / it.quantidade : (it.custo || 0),
      quantidade: it.quantidade || 1,
    }))

    pageSwitch.showForm('Editar Compra',
      (body, close) => {
        const dl = el('datalist', { id: 'ce-forn-list' })
        fornecedores.forEach(f => dl.appendChild(el('option', { value: f.name })))

        const fornInp = el('input', { type: 'text', list: 'ce-forn-list', placeholder: 'Fornecedor' })
        fornInp.value = compra.fornecedor || ''

        const aparelhoInp = el('textarea', { rows: '3', class: 'field-textarea',
          placeholder: 'Specs, serial, IMEI... (aparece no recibo do cliente)' })
        aparelhoInp.value = compra.observacoes || ''

        const { itensWrap, addItemBtn, getItens } = criarEditorItens(produtoNomes, produtosCatalogo, itensIniciais)

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', close)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')
        okBtn.addEventListener('click', async () => {
          const validos = getItens().filter(it => it.produto.trim())
          if (!validos.length) { toastError('Adicione ao menos um produto.'); return }
          okBtn.disabled = true
          try {
            await updateCompraItens(compra,
              validos.map(it => ({
                produtoId:  it.produtoId,
                produto:    it.produto.trim(),
                quantidade: it.quantidade,
                custo:      (parseFloat(it.custoUnit) || 0) * (parseInt(it.quantidade) || 1),
              })),
              { fornecedor: fornInp.value, observacoes: aparelhoInp.value }
            )
            toastSuccess('Compra atualizada.'); close()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar.')
            okBtn.disabled = false
          }
        })

        mount(body,
          dl,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Fornecedor'), fornInp),
          ),
          el('div', { class: 'form-produto-header' },
            el('p', { class: 'form-sub-label' }, 'Itens'),
            addItemBtn
          ),
          itensWrap,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Dados do aparelho'), aparelhoInp),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      })
  }

  function confirmDelete(c) {
    openConfirm({
      title:        'Excluir compra',
      message:      `Excluir compra de "${c.produto}"?${c.pedidoId ? ' O lançamento financeiro (Pagamento) vinculado também será excluído.' : ''}`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deleteCompra(c.id); toastSuccess('Compra excluída.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  const pageSwitch = createFullPageSwitcher(container)
  mount(pageSwitch.listWrap, kpisRow, toolbar, tableWrap, emptyState)
  refresh()

  return {
    update(newCompras) { compras = newCompras; refresh() },
  }
}
