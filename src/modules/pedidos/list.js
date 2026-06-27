import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import {
  deletePedido, patchPedido, confirmarPagamento,
  definirLogistica, salvarRoteiro, marcarEntregue,
} from './service.js'
import { renderPedidoForm } from './form.js'

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_META = {
  negociando:           { label: 'Negociando',   cls: 'badge-negociando'    },
  aguardando_pagamento: { label: 'Aguard. Pgto', cls: 'badge-aguard-pgto'   },
  pago:                 { label: 'Pago',          cls: 'badge-pago'          },
  motoboy:              { label: '🏍️ Motoboy',    cls: 'badge-motoboy'       },
  retirada:             { label: '🏠 Retirada',   cls: 'badge-retirada'      },
  correio:              { label: '📬 Correio',    cls: 'badge-correio'       },
  entregue:             { label: '✅ Entregue',   cls: 'badge-entregue'      },
  cancelado:            { label: 'Cancelado',     cls: 'badge-cancelado'     },
}

const PAID_STATUSES   = new Set(['pago', 'motoboy', 'retirada', 'correio', 'entregue'])
const ACTIVE_STATUSES = new Set(['negociando', 'aguardando_pagamento'])
const DELIVERY_STATUSES = new Set(['motoboy', 'retirada', 'correio'])

const PAG_LABEL = { pix: '🏦 PIX', dinheiro: '💰 Dinheiro', cartao: '💳 Cartão', link: '🏪 Link' }

// ── Ícones SVG ────────────────────────────────────────────────────────────────
const PATHS = {
  edit:    ['M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  arrow:   ['M5 12h14', 'M12 5l7 7-7 7'],
  check:   ['M20 6L9 17l-5-5'],
  checkOk: ['M22 11.08V12a10 10 0 11-5.93-9.14', 'M22 4L12 14.01l-3-3'],
  truck:   ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7V8z', 'M5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', 'M18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z'],
  map:     ['M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z', 'M8 2v16', 'M16 6v16'],
  x:       ['M18 6L6 18', 'M6 6l12 12'],
  trash:   ['M3 6h18', 'M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2'],
}

function ico(key, size = 13) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: size, height: size, style: 'flex-shrink:0;margin-right:4px;vertical-align:middle',
  })
  PATHS[key].forEach(d => svg.appendChild(svgEl('path', { d })))
  return svg
}

function actionBtn(iconKey, label, cls, onClick) {
  const btn = el('button', { type: 'button', class: `btn btn-sm ${cls}` })
  btn.append(ico(iconKey), label)
  btn.addEventListener('click', onClick)
  return btn
}

// ── Helpers de data ───────────────────────────────────────────────────────────
function monthKey(iso) { return iso ? iso.slice(0, 7) : '' }
function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(ym) {
  const [y, m] = ym.split('-')
  const ms = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${ms[+m - 1]} ${y}`
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Roteiro WhatsApp ──────────────────────────────────────────────────────────
function formatRoteiro(paradas, pedido) {
  const lines = [`🏍️ *ROTEIRO — Baruk Technology*`, '']
  paradas.forEach((p, i) => {
    lines.push(`📦 *PARADA ${i + 1}*`)
    lines.push('↑ *RETIRADA*')
    if (p.retirada?.item) lines.push(`• Item: ${p.retirada.item}`)
    if (p.retirada?.loja) lines.push(`• Loja: ${p.retirada.loja}`)
    lines.push('')
    lines.push('↓ *ENTREGA*')
    if (p.entrega?.endereco) lines.push(`• Endereço: ${p.entrega.endereco}`)
    if (p.entrega?.cliente)  lines.push(`• Cliente: ${p.entrega.cliente}`)
    if (p.entrega?.item)     lines.push(`• Item: ${p.entrega.item}`)
    lines.push('')
  })
  return lines.join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function renderPedidoList(container, pedidos, { clientes, produtosCatalogo, fornecedores }) {
  const canCreate = can('pedidos', 'create')
  const canEdit   = can('pedidos', 'edit')
  const canDelete = can('pedidos', 'delete')

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalEl = el('div', { class: 'pedido-stat-value' })
  const valorEl = el('div', { class: 'pedido-stat-value green' })
  const pagosEl = el('div', { class: 'pedido-stat-value green' })
  const pendEl  = el('div', { class: 'pedido-stat-value' })
  const subLabel = el('span', {})

  function updateKpis(list) {
    const valor = list.reduce((s, p) => s + (p.valorNegociado || p.totalVenda || 0), 0)
    const pagos = list.filter(p => PAID_STATUSES.has(p.status)).length
    const pend  = list.filter(p => ACTIVE_STATUSES.has(p.status)).length
    totalEl.textContent = list.length
    valorEl.textContent = brl(valor)
    pagosEl.textContent = pagos
    pendEl.textContent  = pend
    pendEl.className    = 'pedido-stat-value ' + (pend > 0 ? 'red' : '')
    subLabel.textContent = monthLabel(currentMonth)
  }

  let currentMonth = nowMonth()

  const monthNavLabel = el('span', { class: 'month-nav-label' })
  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); refresh() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); refresh() })

  const kpisRow = el('div', { class: 'pedidos-stats' },
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Pedidos'),   totalEl, el('div', { class: 'pedido-stat-sub' }, subLabel)),
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Negociado'), valorEl, el('div', { class: 'pedido-stat-sub' }, 'total')),
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Pagos'),     pagosEl, el('div', { class: 'pedido-stat-sub' }, 'confirmados')),
    el('div', { class: 'pedido-stat' }, el('div', { class: 'pedido-stat-label' }, 'Pendentes'), pendEl,  el('div', { class: 'pedido-stat-sub' }, 'negoc. + aguard.')),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar por cliente ou produto...' })
  searchInp.addEventListener('input', () => refresh())

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Novo Pedido')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => openPedidoModal(null))

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:10px;align-items:center' },
      newBtn,
      el('div', { class: 'month-nav' }, prevBtn, monthNavLabel, nextBtn)
    ),
    countBadge
  )

  // ── Tabela ────────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produtos'),
        el('th', { class: 'th-money' }, 'Valor'),
        el('th', {}, 'Pgto'),
        el('th', {}, 'Status'),
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, 'Ações')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhum pedido encontrado.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      canCreate ? 'Clique em "+ Novo Pedido" para começar.' : '')
  )

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = pedidos.filter(p => monthKey(p.dataContato || p.data || '') === currentMonth)
    if (q) list = list.filter(p => {
      const cli  = (p.cliente || p.clienteNome || '').toLowerCase()
      const pros = (p.produtos || []).map(pr => pr.nome || '').join(' ').toLowerCase()
      return cli.includes(q) || pros.includes(q)
    })
    return list
  }

  function refresh() {
    monthNavLabel.textContent = monthLabel(currentMonth)
    const list = filteredList()
    countBadge.textContent = list.length
    updateKpis(list)
    renderTable(list)
  }

  function renderTable(list) {
    tbody.replaceChildren()
    if (!list.length) {
      tableWrap.classList.add('hidden'); emptyState.classList.remove('hidden'); return
    }
    tableWrap.classList.remove('hidden'); emptyState.classList.add('hidden')

    list.forEach((p, rowIdx) => {
      const meta = STATUS_META[p.status] || { label: p.status || '—', cls: 'badge-negociando' }

      // Produtos
      const prodsCell = el('td', { class: 'td-produtos' })
      ;(p.produtos || []).forEach(pr => {
        const info = [pr.nome, pr.cor].filter(Boolean).join(' · ')
        prodsCell.appendChild(
          el('div', { class: 'pedido-produto-line' },
            el('span', { class: 'dot' }, '●'),
            el('span', { class: 'pedido-produto-nome' }, info || '—'),
          )
        )
        if (pr.acessorios?.length) {
          const sub = el('div', { class: 'pedido-produto-sub' })
          pr.acessorios.forEach(a => sub.appendChild(el('span', { class: 'acessorios-tag' }, a)))
          prodsCell.appendChild(sub)
        }
      })

      const valor = p.valorNegociado ?? p.totalVenda ?? 0

      // Ações
      const actionsCell = el('td', { class: 'td-actions' })

      if (canEdit) {
        actionsCell.appendChild(actionBtn('edit', 'Editar', 'btn-outline', () => openPedidoModal(p)))
      }

      if (canEdit && p.status === 'negociando') {
        actionsCell.appendChild(actionBtn('arrow', 'Aguardar Pgto', 'btn-outline-blue', () => advanceStatus(p.id, 'aguardando_pagamento')))
        actionsCell.appendChild(actionBtn('x', 'Cancelar', 'btn-danger-outline', () => cancelarPedido(p)))
      }

      if (canEdit && p.status === 'aguardando_pagamento') {
        actionsCell.appendChild(actionBtn('check', 'Confirmar Pgto', 'btn-success', () => confirmarPgto(p.id)))
        actionsCell.appendChild(actionBtn('x', 'Cancelar', 'btn-danger-outline', () => cancelarPedido(p)))
      }

      if (canEdit && p.status === 'pago') {
        actionsCell.appendChild(actionBtn('truck', 'Definir Entrega', 'btn-outline-blue', () => abrirLogisticaModal(p)))
      }

      if (canEdit && p.status === 'motoboy') {
        actionsCell.appendChild(actionBtn('map', 'Roteiro', 'btn-outline-blue', () => abrirRoteiroModal(p)))
        actionsCell.appendChild(actionBtn('checkOk', 'Entregue', 'btn-success', () => confirmarEntrega(p.id)))
      }

      if (canEdit && (p.status === 'retirada' || p.status === 'correio')) {
        actionsCell.appendChild(actionBtn('checkOk', 'Entregue', 'btn-success', () => confirmarEntrega(p.id)))
      }

      if (canDelete && p.status === 'cancelado') {
        actionsCell.appendChild(actionBtn('trash', 'Excluir', 'btn-danger-outline', () => confirmDelete(p)))
      }

      const row = el('tr', { class: rowIdx % 2 === 1 ? 'row-alt' : '' },
        el('td', { class: 'td-date' }, shortDate(p.dataContato || p.data || '')),
        el('td', { class: 'td-name' }, p.cliente || p.clienteNome || '—'),
        prodsCell,
        el('td', { class: 'td-money' }, brl(valor)),
        el('td', {}, p.formaPagamento ? (PAG_LABEL[p.formaPagamento] || p.formaPagamento) : '—'),
        el('td', {}, el('span', { class: `status-badge ${meta.cls}` }, meta.label)),
        ...(canEdit || canDelete ? [actionsCell] : []),
      )
      tbody.appendChild(row)
    })
  }

  // ── Ações ─────────────────────────────────────────────────────────────────
  async function advanceStatus(id, status) {
    try { await patchPedido(id, { status }); toastSuccess('Status atualizado.') }
    catch { toastError('Erro ao atualizar status.') }
  }

  async function confirmarPgto(id) {
    try { await confirmarPagamento(id); toastSuccess('Pagamento confirmado.') }
    catch { toastError('Erro ao confirmar pagamento.') }
  }

  async function confirmarEntrega(id) {
    try { await marcarEntregue(id); toastSuccess('Pedido marcado como entregue.') }
    catch { toastError('Erro ao marcar entrega.') }
  }

  function cancelarPedido(p) {
    openConfirm({
      title: 'Cancelar pedido',
      message: `Cancelar pedido de "${p.cliente || p.clienteNome}"?`,
      confirmLabel: 'Cancelar pedido',
      danger: true,
      onConfirm: () => advanceStatus(p.id, 'cancelado'),
    })
  }

  function confirmDelete(p) {
    openConfirm({
      title: 'Excluir pedido',
      message: `Excluir pedido de "${p.cliente || p.clienteNome}"? Não pode ser desfeito.`,
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        try { await deletePedido(p.id); toastSuccess('Pedido excluído.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  // ── Modal logística ───────────────────────────────────────────────────────
  function abrirLogisticaModal(pedido) {
    openModal({
      title: 'Definir Entrega',
      size: 'sm',
      renderBody: (body, closeModal) => {
        async function escolher(tipo) {
          try {
            await definirLogistica(pedido.id, tipo)
            toastSuccess('Entrega definida.')
            closeModal()
            if (tipo === 'motoboy') setTimeout(() => abrirRoteiroModal({ ...pedido, status: 'motoboy', logistica: { tipo } }), 300)
          } catch { toastError('Erro ao definir entrega.') }
        }

        function optBtn(emoji, titulo, desc, tipo) {
          const btn = el('button', { type: 'button', class: 'logistica-opt-btn' })
          btn.append(
            el('div', { class: 'logistica-opt-icon' }, emoji),
            el('div', { class: 'logistica-opt-info' },
              el('strong', {}, titulo),
              el('span', {}, desc)
            )
          )
          btn.addEventListener('click', () => escolher(tipo))
          return btn
        }

        body.append(
          el('p', { style: 'margin-bottom:16px;font-size:14px;color:var(--color-muted)' }, 'Como será a entrega?'),
          el('div', { class: 'logistica-opts' },
            optBtn('🏍️', 'Motoboy', 'Entrega em domicílio — monta o roteiro', 'motoboy'),
            optBtn('🏠', 'Retirada', 'Cliente retira na loja', 'retirada'),
            optBtn('📬', 'Correio', 'Envio pelos Correios', 'correio'),
          )
        )
      },
    })
  }

  // ── Modal roteiro ─────────────────────────────────────────────────────────
  function abrirRoteiroModal(pedido) {
    openModal({
      title: '🏍️ Roteiro de Entrega',
      size: 'lg',
      renderBody: (body, closeModal) => {
        // Inicializa paradas
        let paradas = pedido.logistica?.roteiro?.length
          ? pedido.logistica.roteiro.map(p => ({
              retirada: { ...p.retirada },
              entrega:  { ...p.entrega  },
            }))
          : (pedido.produtos || [{}]).map(pr => ({
              retirada: { item: [pr.nome, pr.cor].filter(Boolean).join(' '), loja: '' },
              entrega:  { endereco: '', cliente: pedido.cliente || '', item: [pr.nome, pr.cor].filter(Boolean).join(' ') },
            }))

        const paradasWrap = el('div', { class: 'roteiro-paradas' })

        function renderParadas() {
          paradasWrap.replaceChildren()
          paradas.forEach((p, i) => {
            function inp(val, onInput, placeholder) {
              const el2 = el('input', { type: 'text', placeholder })
              el2.value = val || ''
              el2.addEventListener('input', () => onInput(el2.value))
              return el2
            }

            const removeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline roteiro-remove-btn' }, '×')
            removeBtn.addEventListener('click', () => { paradas.splice(i, 1); renderParadas() })

            paradasWrap.appendChild(
              el('div', { class: 'roteiro-parada' },
                el('div', { class: 'roteiro-parada-header' },
                  el('span', { class: 'roteiro-parada-num' }, `Parada ${i + 1}`),
                  paradas.length > 1 ? removeBtn : el('span', {})
                ),
                el('div', { class: 'roteiro-section roteiro-retirada' },
                  el('div', { class: 'roteiro-section-title' }, '↑ Retirada'),
                  el('div', { class: 'roteiro-fields' },
                    el('div', { class: 'field' }, el('label', {}, 'Item'),
                      inp(p.retirada?.item, v => { paradas[i].retirada.item = v }, 'Item retirado')),
                    el('div', { class: 'field' }, el('label', {}, 'Loja / Fornecedor'),
                      inp(p.retirada?.loja, v => { paradas[i].retirada.loja = v }, 'ex: Mohamed Ln229')),
                  )
                ),
                el('div', { class: 'roteiro-section roteiro-entrega' },
                  el('div', { class: 'roteiro-section-title' }, '↓ Entrega'),
                  el('div', { class: 'roteiro-fields' },
                    el('div', { class: 'field' }, el('label', {}, 'Endereço'),
                      inp(p.entrega?.endereco, v => { paradas[i].entrega.endereco = v }, 'Rua, número, bairro...')),
                    el('div', { class: 'field' }, el('label', {}, 'Cliente'),
                      inp(p.entrega?.cliente, v => { paradas[i].entrega.cliente = v }, 'Nome do cliente')),
                    el('div', { class: 'field' }, el('label', {}, 'Item'),
                      inp(p.entrega?.item, v => { paradas[i].entrega.item = v }, 'Item entregue')),
                  )
                )
              )
            )
          })
        }

        renderParadas()

        const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Parada')
        addBtn.addEventListener('click', () => {
          paradas.push({ retirada: { item: '', loja: '' }, entrega: { endereco: '', cliente: pedido.cliente || '', item: '' } })
          renderParadas()
        })

        const waBtn = el('button', { type: 'button', class: 'btn btn-success' }, '📱 WhatsApp')
        waBtn.addEventListener('click', () => {
          const text = formatRoteiro(paradas, pedido)
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank')
        })

        const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
          try {
            await salvarRoteiro(pedido.id, paradas)
            toastSuccess('Roteiro salvo.')
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar roteiro.')
            saveBtn.disabled = false; saveBtn.textContent = 'Salvar'
          }
        })

        mount(body,
          paradasWrap,
          el('div', { class: 'roteiro-footer' }, addBtn, el('div', { style: 'display:flex;gap:8px' }, waBtn, saveBtn))
        )
      },
    })
  }

  // ── Pedido modal ──────────────────────────────────────────────────────────
  function openPedidoModal(p) {
    openModal({
      title: p ? 'Editar Pedido' : 'Novo Pedido',
      size:  'lg',
      renderBody: (body, close) => renderPedidoForm(body, close, p, { clientes, produtosCatalogo, fornecedores }),
    })
  }

  mount(container, kpisRow, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return { update(newPedidos) { pedidos = newPedidos; refresh() } }
}
