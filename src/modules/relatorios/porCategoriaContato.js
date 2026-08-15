import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { subscribeFinanceiro } from '../financeiro/service.js'
import { subscribeClientes } from '../clientes/service.js'
import { subscribeFornecedores } from '../fornecedores/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { openModal } from '../../shared/components/Modal.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { createChipSelect } from '../../shared/components/ChipSelect.js'
import { presetRange } from '../../shared/utils/periodo.js'
import { lancamentosNoPeriodo } from './financeiroCalc.js'
import { buildNomeMap, nomeVivo } from '../../shared/utils/nomeVivo.js'

const TIPO_META = {
  pagar:   { label: 'Pagamentos',   verbo: 'Gasto' },
  receber: { label: 'Recebimentos', verbo: 'Recebido' },
}

export function renderPorCategoriaContato(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando lançamentos...'))
  return _init(container)
}

function _init(container) {
  let lancamentos = []
  let clientes = []
  let fornecedores = []
  let periodo = presetRange('este-mes')
  let tipo = 'pagar'
  let agrupador = 'categoria' // 'categoria' | 'contato'
  let firstLoad = true

  const picker = createPeriodoPicker({
    initialPreset: 'este-mes',
    onChange: p => { periodo = p; update() },
  })

  const tipoChips = createChipSelect(
    Object.entries(TIPO_META).map(([key, m]) => ({ value: key, label: m.label })),
    { value: tipo, onChange: v => { tipo = v; update() } }
  )
  const agrupadorChips = createChipSelect(
    [{ value: 'categoria', label: 'Por categoria' }, { value: 'contato', label: 'Por contato' }],
    { value: agrupador, onChange: v => { agrupador = v; update() } }
  )

  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar...', style: 'margin-bottom:0' })
  searchInp.addEventListener('input', () => update())

  const reportWrap = el('div', {})

  function update() {
    reportWrap.replaceChildren(buildRelatorio({
      lancamentos, clientes, fornecedores, periodo, tipo, agrupador,
      busca: searchInp.value.trim().toLowerCase(),
    }))
  }

  function renderScreen() {
    mount(container,
      el('div', { class: 'relatorio-toolbar', style: 'display:flex;align-items:center;flex-wrap:wrap;gap:12px' },
        picker.el, tipoChips.el, agrupadorChips.el, searchInp,
      ),
      reportWrap
    )
    update()
  }

  // A tela desenha assim que os lançamentos chegam — clientes/fornecedores
  // podem chegar depois, só refinam o nome exibido (nomeVivo já cai pro
  // texto congelado enquanto isso).
  const unsubFinanceiro = subscribeFinanceiro(
    list => {
      lancamentos = list
      if (firstLoad) { firstLoad = false; renderScreen() } else { update() }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar lançamentos.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )
  const unsubClientes = subscribeClientes(list => { clientes = list; if (!firstLoad) update() }, () => {})
  const unsubFornecedores = subscribeFornecedores(list => { fornecedores = list; if (!firstLoad) update() }, () => {})

  return () => { unsubFinanceiro?.(); unsubClientes?.(); unsubFornecedores?.() }
}

function agrupar(lancamentosPeriodo, agrupador, clientesMap, fornecedoresMap) {
  const mapa = new Map()
  lancamentosPeriodo.forEach(l => {
    const chave = agrupador === 'categoria'
      ? (l.categoria || 'Sem categoria')
      : (nomeVivo(l.contatoId, l.contato, l.contatoTipo === 'fornecedor' ? fornecedoresMap : clientesMap) || 'Sem contato')
    const atual = mapa.get(chave) || { nome: chave, valor: 0, qtd: 0, itens: [] }
    atual.valor += Number(l.valor) || 0
    atual.qtd += 1
    atual.itens.push(l)
    mapa.set(chave, atual)
  })
  return [...mapa.values()].sort((a, b) => b.valor - a.valor)
}

function abrirDrillDownModal(grupo, tipoMeta, clientesMap, fornecedoresMap) {
  openModal({
    title: grupo.nome,
    size: 'md',
    renderBody: (body) => {
      const itensOrdenados = [...grupo.itens].sort((a, b) => (b.dataLiquidacao || '').localeCompare(a.dataLiquidacao || ''))
      const tbody = document.createElement('tbody')
      itensOrdenados.forEach(l => {
        const contatoNome = nomeVivo(l.contatoId, l.contato, l.contatoTipo === 'fornecedor' ? fornecedoresMap : clientesMap)
        tbody.appendChild(el('tr', {},
          el('td', { class: 'td-date' }, shortDate(l.dataLiquidacao)),
          el('td', { class: 'td-name', title: l.descricao || '' }, l.descricao || '—'),
          el('td', { class: 'td-name', title: contatoNome }, contatoNome || '—'),
          el('td', { class: 'td-money' }, brl(l.valor)),
        ))
      })
      const table = el('div', { class: 'table-wrapper' },
        el('table', { class: 'data-table' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Data'), el('th', {}, 'Descrição'), el('th', {}, 'Contato'), el('th', { class: 'th-money' }, 'Valor'),
          )),
          tbody,
        )
      )
      mount(body,
        el('p', { class: 'text-muted', style: 'margin-bottom:12px' },
          `${grupo.qtd} lançamento${grupo.qtd === 1 ? '' : 's'} · Total ${tipoMeta.verbo.toLowerCase()}: ${brl(grupo.valor)}`),
        table,
      )
    },
  })
}

function buildRelatorio({ lancamentos, clientes, fornecedores, periodo, tipo, agrupador, busca }) {
  const tipoMeta = TIPO_META[tipo]
  const clientesMap = buildNomeMap(clientes)
  const fornecedoresMap = buildNomeMap(fornecedores)

  const doPeriodo = lancamentosNoPeriodo(lancamentos, periodo.de, periodo.ate).filter(l => l.tipo === tipo)
  let ranking = agrupar(doPeriodo, agrupador, clientesMap, fornecedoresMap)
  if (busca) ranking = ranking.filter(r => r.nome.toLowerCase().includes(busca))

  const totalGeral = doPeriodo.reduce((s, l) => s + (Number(l.valor) || 0), 0)

  const kpis = el('div', { class: 'pedidos-stats' },
    kpiCard(agrupador === 'categoria' ? 'Categorias' : 'Contatos', ranking.length),
    kpiCard('Lançamentos', doPeriodo.length),
    kpiCard(`Total ${tipoMeta.label.toLowerCase()}`, brl(totalGeral)),
  )

  if (!ranking.length) {
    return el('div', {}, kpis, el('div', { class: 'empty-state' }, el('p', {}, 'Nada encontrado nesse período.')))
  }

  const tbody = document.createElement('tbody')
  ranking.forEach(r => {
    const row = el('tr', { class: 'row-clicavel' },
      el('td', { class: 'td-name', title: r.nome }, r.nome),
      el('td', { class: 'td-money' }, String(r.qtd)),
      el('td', { class: 'td-money' }, brl(r.valor)),
    )
    row.addEventListener('click', () => abrirDrillDownModal(r, tipoMeta, clientesMap, fornecedoresMap))
    tbody.appendChild(row)
  })

  const table = el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table' },
      el('thead', {}, el('tr', {},
        el('th', {}, agrupador === 'categoria' ? 'Categoria' : 'Contato'),
        el('th', { class: 'th-money' }, 'Lançamentos'),
        el('th', { class: 'th-money' }, 'Total'),
      )),
      tbody,
    )
  )

  return el('div', {}, kpis, table)
}

function kpiCard(label, value) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: 'pedido-stat-value' }, String(value)),
  )
}
