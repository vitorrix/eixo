import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { brl, fullDate } from '../../shared/utils/formatters.js'
import { toastError } from '../../shared/components/Toast.js'
import { openModal } from '../../shared/components/Modal.js'
import { getEmpresa } from '../configuracoes/service.js'
import { subscribeClientes } from '../clientes/service.js'
import {
  montarDadosReciboHistorico, renderReciboPreview, criarBotaoImprimir,
  toWhatsappNumber, enviarReciboFila, FILA_STATUS_LABEL,
} from '../../shared/components/Recibo.js'

const PAGE_SIZE_OPTIONS = [20, 50, 100]

// "Mais recentes" (dataConfirmacao desc) é o default — é como o relatório
// do sistema anterior já vinha ordenado, mantendo a leitura que o Vitor já
// conhece do E-gestor de origem.
const SORT_OPTIONS = [
  { key: 'recentes', label: 'Mais recentes' },
  { key: 'antigas',  label: 'Mais antigas' },
  { key: 'maior',    label: 'Maior valor' },
  { key: 'menor',    label: 'Menor valor' },
  { key: 'cliente',  label: 'Cliente A-Z' },
]

function filterGroup(labelText, widgetEl) {
  return el('div', { class: 'busca-filter-group' },
    el('span', { class: 'busca-filter-label' }, labelText),
    widgetEl
  )
}

function kpiCard(label, value, cls) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: `pedido-stat-value ${cls || ''}` }, value),
  )
}

function sortList(list, sort) {
  const copy = [...list]
  switch (sort) {
    case 'antigas': copy.sort((a, b) => (a.dataConfirmacao || '').localeCompare(b.dataConfirmacao || '')); break
    case 'maior':   copy.sort((a, b) => (b.totalVenda || 0) - (a.totalVenda || 0)); break
    case 'menor':   copy.sort((a, b) => (a.totalVenda || 0) - (b.totalVenda || 0)); break
    case 'cliente': copy.sort((a, b) => (a.cliente || '').localeCompare(b.cliente || '', 'pt-BR')); break
    default:        copy.sort((a, b) => (b.dataConfirmacao || '').localeCompare(a.dataConfirmacao || ''))
  }
  return copy
}

// Histórico de vendas importado do sistema anterior (E-gestor) — só consulta
// e emissão de recibo pra cliente antigo que liga pedindo o comprovante.
// Não alimenta DRE/Fluxo de Caixa nem nenhum relatório atual: é um arquivo
// morto, à parte de Vendas/Financeiro. Coleção só leitura (ver firestore.rules) —
// importada uma vez via script com firebase-admin, nunca escrita pelo app.
export function renderEgestor(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando histórico...'))
  return _init(container)
}

function _init(container) {
  let vendas = []
  let clientes = []
  let empresa = {}
  let currentPage = 1
  let pageSize = PAGE_SIZE_OPTIONS[0]

  const buscaInp = el('input', {
    type: 'search', class: 'busca-search-input', autocomplete: 'off',
    placeholder: 'Buscar por cliente... ex: Ricardo Bayona',
  })
  const deInp  = el('input', { type: 'date', class: 'field-select', autocomplete: 'off' })
  const ateInp = el('input', { type: 'date', class: 'field-select', autocomplete: 'off' })
  const sortSel = el('select', { class: 'field-select' },
    ...SORT_OPTIONS.map(o => el('option', { value: o.key }, o.label)))

  const filtersRow = el('div', { class: 'busca-filters-row' },
    filterGroup('De', deInp),
    filterGroup('Até', ateInp),
    filterGroup('Ordenar por', sortSel),
  )

  const statsRow = el('div', { class: 'pedidos-stats hidden' })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produtos'),
        el('th', {}, 'Pagamento'),
        el('th', { class: 'th-money' }, 'Valor'),
        el('th', { class: 'col-actions' }, ''),
      )
    ),
    tbody
  )
  const tableWrap = el('div', { class: 'table-wrapper hidden' }, table)
  const emptyMsg = el('p', {}, 'Busque por cliente ou selecione um período pra ver as vendas do sistema anterior.')
  const emptyState = el('div', { class: 'empty-state' }, emptyMsg)

  const pageInfo = el('span', { class: 'busca-page-info' })
  const prevBtn = el('button', { type: 'button', class: 'btn-link' }, '‹ Anterior')
  const nextBtn = el('button', { type: 'button', class: 'btn-link' }, 'Próxima ›')
  prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; refresh() } })
  nextBtn.addEventListener('click', () => { currentPage++; refresh() })
  const pageSizeSelect = el('select', { class: 'field-select busca-page-size' },
    ...PAGE_SIZE_OPTIONS.map(n => el('option', { value: n }, `${n} por página`)))
  pageSizeSelect.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value)
    currentPage = 1
    refresh()
  })
  const paginationRow = el('div', { class: 'busca-pagination hidden' }, pageSizeSelect, pageInfo, prevBtn, nextBtn)

  function filteredList() {
    const q = buscaInp.value.trim().toLowerCase()
    const de = deInp.value
    const ate = ateInp.value
    if (!q && !de && !ate) return null // nenhum filtro ativo ainda
    const list = vendas.filter(v => {
      if (q && !(v.clienteBusca || '').includes(q)) return false
      if (de && v.dataConfirmacao < de) return false
      if (ate && v.dataConfirmacao > ate) return false
      return true
    })
    return sortList(list, sortSel.value)
  }

  function resetPageAndRefresh() { currentPage = 1; refresh() }

  function refresh() {
    const list = filteredList()

    if (list === null) {
      tableWrap.classList.add('hidden')
      paginationRow.classList.add('hidden')
      statsRow.classList.add('hidden')
      emptyState.classList.remove('hidden')
      emptyMsg.textContent = 'Busque por cliente ou selecione um período pra ver as vendas do sistema anterior.'
      return
    }
    if (!list.length) {
      tableWrap.classList.add('hidden')
      paginationRow.classList.add('hidden')
      statsRow.classList.add('hidden')
      emptyState.classList.remove('hidden')
      emptyMsg.textContent = 'Nenhuma venda encontrada.'
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')

    const totalValor = list.reduce((s, v) => s + (v.totalVenda || 0), 0)
    statsRow.replaceChildren(
      kpiCard('Vendas encontradas', String(list.length)),
      kpiCard('Valor total', brl(totalValor), 'green'),
      kpiCard('Ticket médio', brl(totalValor / list.length)),
    )
    statsRow.classList.remove('hidden')

    const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
    if (currentPage > totalPages) currentPage = totalPages
    if (currentPage < 1) currentPage = 1
    const pageSlice = list.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`
    prevBtn.disabled = currentPage <= 1
    nextBtn.disabled = currentPage >= totalPages
    paginationRow.classList.remove('hidden')

    tbody.replaceChildren()
    pageSlice.forEach(v => {
      const produtosTxt = (v.itens || []).map(it => it.produto).filter(Boolean).join(', ') || '—'
      const reciboBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, 'Recibo')
      reciboBtn.addEventListener('click', () => abrirReciboModal(v))

      const clienteCell = el('td', { class: 'td-name', title: v.cliente || '' },
        el('div', {}, v.cliente || '—'),
        el('div', { class: 'egestor-codigo' }, `Nº E-${v.codigoOriginal}`),
      )
      const pagamentoCell = v.formaPagamento
        ? el('td', {}, el('span', { class: 'egestor-pagamento' }, v.formaPagamento))
        : el('td', { class: 'text-muted' }, '—')

      tbody.appendChild(el('tr', {},
        el('td', { class: 'td-date' }, fullDate(v.dataConfirmacao || v.dataCriacao)),
        clienteCell,
        el('td', {}, produtosTxt),
        pagamentoCell,
        el('td', { class: 'td-money' }, brl(v.totalVenda)),
        el('td', { class: 'col-actions' }, reciboBtn),
      ))
    })
  }

  function abrirReciboModal(venda) {
    openModal({
      title: 'Recibo',
      size: 'lg',
      renderBody: (body, closeModal) => {
        const cliente = clientes.find(c => c.name === venda.cliente)
        const dados = montarDadosReciboHistorico(venda, { empresa, cliente })
        const previewWrap = el('div', {})
        renderReciboPreview(previewWrap, dados)

        const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fecharBtn.addEventListener('click', closeModal)
        const imprimirBtn = criarBotaoImprimir()

        const telefone = toWhatsappNumber(cliente?.phone)
        const statusEl = el('span', { class: 'text-muted', style: 'margin-left:10px;font-size:13px' })
        const enviarBtn = el('button', { type: 'button', class: 'btn btn-success' }, 'Enviar por WhatsApp')
        enviarBtn.addEventListener('click', async () => {
          enviarBtn.disabled = true
          try {
            await enviarReciboFila({ dados, telefone })
            statusEl.textContent = FILA_STATUS_LABEL.pendente
          } catch (err) {
            console.error(err)
            statusEl.textContent = 'Erro ao enviar.'
            enviarBtn.disabled = false
          }
        })
        if (!telefone) {
          enviarBtn.disabled = true
          statusEl.textContent = 'Cliente sem telefone cadastrado no Eixo.'
        }

        mount(body,
          previewWrap,
          el('div', { class: 'modal-footer no-print' }, fecharBtn, imprimirBtn, enviarBtn, statusEl)
        )
      },
    })
  }

  buscaInp.addEventListener('input', resetPageAndRefresh)
  deInp.addEventListener('change', resetPageAndRefresh)
  ateInp.addEventListener('change', resetPageAndRefresh)
  sortSel.addEventListener('change', resetPageAndRefresh)

  async function carregar() {
    try {
      const snap = await getDocs(collection(db, 'vendasHistoricas'))
      vendas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      mount(container,
        buscaInp,
        filtersRow,
        statsRow,
        tableWrap,
        emptyState,
        paginationRow,
      )
      refresh()
    } catch (err) {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar histórico.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  }

  const unsubClientes = subscribeClientes(list => { clientes = list }, () => {})
  getEmpresa().then(e => { empresa = e }).catch(() => {})
  carregar()

  return () => { unsubClientes?.() }
}
