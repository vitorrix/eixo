import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import {
  montarDadosRecibo, montarDadosReciboVendaAvulsa, renderReciboPreview,
  garantirNumeroRecibo, toWhatsappNumber, enviarReciboFila, FILA_STATUS_LABEL, criarBotaoImprimir,
} from '../../shared/components/Recibo.js'
import { patchPedido } from '../pedidos/service.js'
import { createVenda, patchVenda, deleteVenda } from './service.js'

const ENTREGA_META = {
  aguardando: { label: 'Aguardando',    cls: 'badge-negociando'  },
  retirada:   { label: '🏠 Retirada',   cls: 'badge-comprado'    },
  motoboy:    { label: '🏍️ Motoboy',    cls: 'badge-comprado'    },
  correio:    { label: '✈️ Correio',     cls: 'badge-comprado'    },
  entregue:   { label: '✅ Entregue',    cls: 'badge-recebido'    },
}

const ENTREGA_ORDER = ['aguardando', 'retirada', 'motoboy', 'correio', 'entregue']

const PAG_LABEL = { pix: '🏦 PIX', dinheiro: '💰 Dinheiro', cartao: '💳 Cartão', link: '🏪 Link' }

function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthKey(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function renderVendasList(container, vendas, { produtosCatalogo, clientes, usuariosPorUid = {}, empresa = {} } = {}) {
  const canCreate = can('vendas', 'create')
  const canEdit   = can('vendas', 'edit')
  const canDelete = can('vendas', 'delete')

  let currentMonth = nowMonth()

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEl   = el('div', { class: 'pedido-stat-value' })
  const fatEl     = el('div', { class: 'pedido-stat-value green' })
  const ticketEl  = el('div', { class: 'pedido-stat-value' })
  const pendEl    = el('div', { class: 'pedido-stat-value' })

  function updateKpis(list) {
    const fat  = list.reduce((s, v) => s + (v.valorVenda || 0), 0)
    const pend = list.filter(v => v.statusEntrega !== 'entregue').length
    totalEl.textContent  = list.length
    fatEl.textContent    = brl(fat)
    ticketEl.textContent = list.length ? brl(Math.round(fat / list.length)) : brl(0)
    pendEl.textContent   = pend
    pendEl.className     = 'pedido-stat-value ' + (pend > 0 ? 'red' : '')
  }

  function kpiCard(label, valueEl, sub) {
    return el('div', { class: 'pedido-stat' },
      el('div', { class: 'pedido-stat-label' }, label),
      valueEl,
      el('div', { class: 'pedido-stat-sub' }, sub)
    )
  }

  const kpisRow = el('div', { class: 'pedidos-stats' },
    kpiCard('Vendas',       totalEl,  'no mês'),
    kpiCard('Faturamento',  fatEl,    'receita'),
    kpiCard('Ticket Médio', ticketEl, 'por venda'),
    kpiCard('Pendentes',    pendEl,   'não entregues'),
  )

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input',
    placeholder: 'Buscar por cliente ou produto...' })
  searchInp.addEventListener('input', () => refresh())

  const monthNavLabel = el('span', { class: 'month-nav-label' })
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

  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); refresh() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); refresh() })

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Nova Venda')
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => abrirNovaVendaModal())

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:10px;align-items:center' },
      newBtn,
      el('div', { class: 'month-nav' }, prevBtn, monthNavLabel, nextBtn)
    ),
    countBadge
  )

  // ── Tabela ─────────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produto'),
        el('th', { class: 'th-money' }, 'Valor'),
        el('th', {}, 'Pgto'),
        el('th', {}, 'Entrega'),
        el('th', {}, 'Recibo'),
        ...(canDelete ? [el('th', { class: 'col-actions' }, '')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' },
    el('p', {}, 'Nenhuma venda neste mês.'),
    el('p', { class: 'text-muted', style: 'font-size:13px;margin-top:4px' },
      'As vendas são geradas ao confirmar o pagamento de um pedido.')
  )

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = vendas.filter(v => monthKey(v.criadoEm) === currentMonth)
    if (q) list = list.filter(v =>
      (v.cliente || '').toLowerCase().includes(q) ||
      (v.produto || '').toLowerCase().includes(q)
    )
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
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')

    for (const v of list) {
      const entregaMeta = ENTREGA_META[v.statusEntrega] || ENTREGA_META.aguardando

      // Inline entrega select
      const entregaSel = el('select', { class: `status-inline-sel ${entregaMeta.cls}` })
      ENTREGA_ORDER.forEach(s => {
        const opt = el('option', { value: s }, ENTREGA_META[s]?.label || s)
        if (s === v.statusEntrega) opt.selected = true
        entregaSel.appendChild(opt)
      })
      // Venda vinda de pedido: entrega obedece a logística do pedido, não é editável aqui.
      if (!canEdit || v.pedidoId) entregaSel.disabled = true
      if (v.pedidoId) entregaSel.title = 'Segue a logística do pedido'
      entregaSel.addEventListener('change', async () => {
        const prev = entregaSel.className
        entregaSel.className = `status-inline-sel ${ENTREGA_META[entregaSel.value]?.cls || ''}`
        try {
          await patchVenda(v.id, { statusEntrega: entregaSel.value })
          toastSuccess('Entrega atualizada.')
        } catch {
          toastError('Erro ao atualizar.')
          entregaSel.value = v.statusEntrega
          entregaSel.className = prev
        }
      })

      // Recibo: check de enviado/não enviado (marcado sozinho quando o envio é
      // disparado pelo botão "Recibo" abaixo, mas dá pra corrigir à mão também).
      const reciboChk = el('input', { type: 'checkbox', class: 'recibo-chk' })
      reciboChk.checked = !!v.reciboEmitido
      if (!canEdit) reciboChk.disabled = true
      const reciboLabel = el('label', { class: 'recibo-label' },
        reciboChk,
        el('span', {}, v.reciboEmitido ? 'Enviado' : 'Não enviado')
      )
      reciboChk.addEventListener('change', async () => {
        try {
          await patchVenda(v.id, { reciboEmitido: reciboChk.checked })
          reciboLabel.querySelector('span').textContent = reciboChk.checked ? 'Enviado' : 'Não enviado'
          toastSuccess(reciboChk.checked ? 'Recibo marcado como enviado.' : 'Recibo desmarcado.')
        } catch {
          toastError('Erro ao atualizar recibo.')
          reciboChk.checked = !reciboChk.checked
        }
      })

      const reciboCell = el('td', {}, reciboLabel)
      if (v.statusEntrega === 'entregue') {
        const reciboBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline', style: 'margin-top:4px;display:block' }, 'Recibo')
        reciboBtn.addEventListener('click', () => abrirReciboVendaModal(v))
        reciboCell.appendChild(reciboBtn)
      }

      const dateStr = v.criadoEm?.toDate ? shortDate(v.criadoEm.toDate().toISOString().slice(0,10)) : '—'
      const pagLabel = PAG_LABEL[v.formaPagamento] || v.formaPagamento || '—'

      const actionsCell = el('td', { class: 'col-actions' }, renderRowActions({
        canEdit: false, canDelete,
        onDelete: () => confirmDelete(v),
      }))

      const row = el('tr', {},
        el('td', { class: 'td-date' }, dateStr),
        el('td', { class: 'td-name' }, v.cliente || '—'),
        el('td', {}, v.produto || '—'),
        el('td', { class: 'td-money' }, brl(v.valorVenda || 0)),
        el('td', {}, pagLabel),
        el('td', {}, entregaSel),
        reciboCell,
        ...(canDelete ? [actionsCell] : []),
      )
      tbody.appendChild(row)
    }
  }

  function confirmDelete(v) {
    openConfirm({
      title:        'Excluir venda',
      message:      `Excluir venda de "${v.produto}"${v.cliente ? ` para ${v.cliente}` : ''}?`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deleteVenda(v); toastSuccess('Venda excluída.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  // ── Recibo ────────────────────────────────────────────────────────────────
  // Venda vinda de pedido: o recibo é o do pedido inteiro (todos os itens juntos,
  // igual à tela de Pedidos). Venda avulsa: recibo de item único, puxando os
  // dados do aparelho da Compra mais recente com esse produtoId (melhor esforço
  // — se houver mais de uma compra em aberto do mesmo produto, pode não bater
  // com a unidade exata vendida).
  async function montarReciboVenda(venda) {
    if (venda.pedidoId) {
      const snap = await getDoc(doc(db, 'pedidos', venda.pedidoId))
      if (!snap.exists()) throw new Error('Pedido de origem não encontrado.')
      const pedido = { id: snap.id, ...snap.data() }
      const numero = await garantirNumeroRecibo(pedido, patchPedido)
      const cliente = clientes.find(c => c.name === pedido.cliente)
      const vendedorNome = usuariosPorUid[pedido.criadoPor] || '—'
      return { dados: montarDadosRecibo(pedido, { numero, empresa, cliente, vendedorNome }), tipo: 'pedido', entidade: pedido }
    }

    const numero = await garantirNumeroRecibo(venda, patchVenda)
    const cliente = clientes.find(c => c.name === venda.cliente)
    const vendedorNome = usuariosPorUid[venda.criadoPor] || '—'
    let compra = null
    if (venda.produtoId) {
      const snap = await getDocs(query(collection(db, 'compras'), where('produtoId', '==', venda.produtoId)))
      const candidatas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.observacoes)
        .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
      compra = candidatas[0] || null
    }
    return {
      dados: montarDadosReciboVendaAvulsa(venda, { numero, empresa, cliente, vendedorNome, compra }),
      tipo: 'venda', entidade: venda,
    }
  }

  function abrirReciboVendaModal(venda) {
    openModal({
      title: 'Recibo',
      size:  'lg',
      renderBody: (body, closeModal) => {
        mount(body, el('div', { class: 'loading' }, 'Montando recibo...'))

        montarReciboVenda(venda).then(({ dados, tipo, entidade }) => {
          const previewWrap = el('div', {})
          renderReciboPreview(previewWrap, dados)

          const clienteNome = tipo === 'pedido' ? entidade.cliente : venda.cliente
          const cliente = clientes.find(c => c.name === clienteNome)
          const temTelefone = !!toWhatsappNumber(cliente?.phone)

          const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
          fecharBtn.addEventListener('click', () => { unsubFila?.(); closeModal() })

          const imprimirBtn = criarBotaoImprimir()

          const statusEl = el('span', { class: 'text-muted', style: 'margin-left:10px;font-size:13px' })

          let unsubFila = null
          const enviarBtn = el('button', { type: 'button', class: 'btn btn-success' }, 'Enviar por WhatsApp')
          enviarBtn.addEventListener('click', async () => {
            enviarBtn.disabled = true
            try {
              const telefone = toWhatsappNumber(cliente?.phone)
              const ref = await enviarReciboFila({
                dados, telefone,
                pedidoId: tipo === 'pedido' ? entidade.id : null,
                vendaId:  tipo === 'venda'  ? entidade.id : null,
              })
              // marca "enviado" na venda atual e, se o recibo é de um pedido com
              // várias linhas, em todas as vendas irmãs (o recibo cobre todas juntas).
              if (tipo === 'venda') {
                await patchVenda(venda.id, { reciboEmitido: true })
              } else {
                const snapIrmas = await getDocs(query(collection(db, 'vendas'), where('pedidoId', '==', entidade.id)))
                await Promise.all(snapIrmas.docs.map(d => patchVenda(d.id, { reciboEmitido: true })))
              }
              toastSuccess('Enviado para a fila — o bot manda pro cliente em instantes.')
              statusEl.textContent = FILA_STATUS_LABEL.pendente
              unsubFila = onSnapshot(ref, snap => {
                const fila = snap.data()
                if (!fila) return
                statusEl.textContent = FILA_STATUS_LABEL[fila.status] || fila.status
                if (fila.status === 'erro') enviarBtn.disabled = false
              })
            } catch (err) {
              console.error(err)
              toastError(err.message || 'Erro ao enviar recibo.')
              enviarBtn.disabled = false
            }
          })
          if (!temTelefone) {
            enviarBtn.disabled = true
            statusEl.textContent = 'Cliente sem telefone cadastrado.'
          }

          mount(body,
            previewWrap,
            el('div', { class: 'modal-footer no-print' }, fecharBtn, imprimirBtn, enviarBtn, statusEl)
          )
        }).catch(err => {
          console.error(err)
          mount(body, el('p', { class: 'text-muted' }, 'Erro ao montar o recibo.'))
        })
      },
    })
  }

  function abrirNovaVendaModal() {
    const produtoNomes  = (produtosCatalogo || []).map(p => p.nome)
    const clienteNomes  = (clientes || []).map(c => c.name)

    openModal({
      title: 'Nova Venda',
      size:  'md',
      renderBody: (body, closeModal) => {
        let produtoId = null

        const produtoAc = createAutocomplete({
          placeholder: 'Produto do catálogo',
          items:       produtoNomes,
          onSelect:    v => { produtoId = (produtosCatalogo || []).find(p => p.nome === v)?.id || null },
        })
        produtoAc.el.style.width = '100%'
        produtoAc.el.addEventListener('input', () => {
          produtoId = (produtosCatalogo || []).find(p => p.nome === produtoAc.getValue())?.id || null
        })

        const clienteAc = createAutocomplete({
          placeholder: 'Nome do cliente',
          items:       clienteNomes,
        })
        clienteAc.el.style.width = '100%'

        const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })

        const pagSel = el('select', {})
        Object.entries(PAG_LABEL).forEach(([value, label]) => pagSel.appendChild(el('option', { value }, label)))

        const entregaSelNew = el('select', {})
        ENTREGA_ORDER.forEach(s => entregaSelNew.appendChild(el('option', { value: s }, ENTREGA_META[s]?.label || s)))

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', closeModal)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Criar venda')
        okBtn.addEventListener('click', async () => {
          const produto = produtoAc.getValue().trim()
          if (!produto) { toastError('Selecione o produto.'); return }
          okBtn.disabled = true
          try {
            await createVenda({
              produtoId, produto,
              cliente:        clienteAc.getValue(),
              valorVenda:     valorInp.value,
              formaPagamento: pagSel.value,
              statusEntrega:  entregaSelNew.value,
            })
            toastSuccess('Venda criada.'); closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao criar venda.')
            okBtn.disabled = false
          }
        })

        mount(body,
          el('div', { class: 'form-grid' },
            el('div', { class: 'field field-full' }, el('label', {}, 'Produto'), produtoAc.el),
            el('div', { class: 'field field-full' }, el('label', {}, 'Cliente'), clienteAc.el),
            el('div', { class: 'field' }, el('label', {}, 'Valor R$'), valorInp),
            el('div', { class: 'field' }, el('label', {}, 'Forma de pagamento'), pagSel),
            el('div', { class: 'field' }, el('label', {}, 'Entrega'), entregaSelNew),
          ),
          el('div', { class: 'modal-footer' }, cancelBtn, okBtn)
        )
      },
    })
  }

  mount(container, kpisRow, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return {
    update(newVendas) { vendas = newVendas; refresh() },
  }
}
