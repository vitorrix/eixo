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

  const buscaInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar por cliente...', autocomplete: 'off' })
  const deInp = el('input', { type: 'date', autocomplete: 'off' })
  const ateInp = el('input', { type: 'date', autocomplete: 'off' })

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Data'),
        el('th', {}, 'Cliente'),
        el('th', {}, 'Produtos'),
        el('th', { class: 'th-money' }, 'Valor'),
        el('th', { class: 'col-actions' }, ''),
      )
    ),
    tbody
  )
  const tableWrap = el('div', { class: 'table-wrapper hidden' }, table)
  const emptyMsg = el('p', {}, 'Busque por cliente ou selecione um período pra ver as vendas do sistema anterior.')
  const emptyState = el('div', { class: 'empty-state' }, emptyMsg)
  const countBadge = el('span', { class: 'count-badge' })

  function filteredList() {
    const q = buscaInp.value.trim().toLowerCase()
    const de = deInp.value
    const ate = ateInp.value
    if (!q && !de && !ate) return null // nenhum filtro ativo ainda
    return vendas.filter(v => {
      if (q && !(v.clienteBusca || '').includes(q)) return false
      if (de && v.dataConfirmacao < de) return false
      if (ate && v.dataConfirmacao > ate) return false
      return true
    })
  }

  const MAX_LINHAS = 300

  function refresh() {
    const list = filteredList()
    countBadge.textContent = list ? `${list.length} venda${list.length === 1 ? '' : 's'}` : ''
    tbody.replaceChildren()

    if (list === null) {
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      emptyMsg.textContent = 'Busque por cliente ou selecione um período pra ver as vendas do sistema anterior.'
      return
    }
    if (!list.length) {
      tableWrap.classList.add('hidden')
      emptyState.classList.remove('hidden')
      emptyMsg.textContent = 'Nenhuma venda encontrada.'
      return
    }
    tableWrap.classList.remove('hidden')
    emptyState.classList.add('hidden')

    list.slice(0, MAX_LINHAS).forEach(v => {
      const produtosTxt = (v.itens || []).map(it => it.produto).filter(Boolean).join(', ') || '—'
      const reciboBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, 'Recibo')
      reciboBtn.addEventListener('click', () => abrirReciboModal(v))
      tbody.appendChild(el('tr', {},
        el('td', { class: 'td-date' }, fullDate(v.dataConfirmacao || v.dataCriacao)),
        el('td', { class: 'td-name' }, v.cliente || '—'),
        el('td', {}, produtosTxt),
        el('td', { class: 'td-money' }, brl(v.totalVenda)),
        el('td', { class: 'col-actions' }, reciboBtn),
      ))
    })
    if (list.length > MAX_LINHAS) {
      tbody.appendChild(el('tr', {}, el('td', { colspan: '5', class: 'text-muted' },
        `Mostrando ${MAX_LINHAS} de ${list.length} — refine a busca pra ver o restante.`)))
    }
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

  buscaInp.addEventListener('input', refresh)
  deInp.addEventListener('change', refresh)
  ateInp.addEventListener('change', refresh)

  async function carregar() {
    try {
      const snap = await getDocs(collection(db, 'vendasHistoricas'))
      vendas = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.dataConfirmacao || '').localeCompare(a.dataConfirmacao || ''))

      mount(container,
        el('div', { class: 'toolbar' },
          el('div', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' },
            buscaInp,
            el('div', { class: 'field' }, el('label', {}, 'De'), deInp),
            el('div', { class: 'field' }, el('label', {}, 'Até'), ateInp),
          ),
          countBadge,
        ),
        tableWrap,
        emptyState,
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
