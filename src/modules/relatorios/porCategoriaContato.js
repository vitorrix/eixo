import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { subscribeFinanceiro } from '../financeiro/service.js'
import { subscribeClientes } from '../clientes/service.js'
import { subscribeFornecedores } from '../fornecedores/service.js'
import { getEmpresa } from '../configuracoes/service.js'
import { toastError } from '../../shared/components/Toast.js'
import { openModal } from '../../shared/components/Modal.js'
import { criarBotaoImprimir } from '../../shared/components/Recibo.js'
import { montarDadosExtrato, renderExtratoPreview } from '../../shared/components/ExtratoContato.js'
import { createPeriodoPicker } from '../../shared/components/PeriodoPicker.js'
import { createChipSelect } from '../../shared/components/ChipSelect.js'
import { createSortableHead } from '../../shared/components/SortableHead.js'
import { presetRange, periodoLabel } from '../../shared/utils/periodo.js'
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
  let empresa = {}
  let periodo = presetRange('este-mes')
  let tipo = 'pagar'
  let agrupador = 'categoria' // 'categoria' | 'contato'
  let firstLoad = true

  getEmpresa().then(e => { empresa = e }).catch(() => {}) // extrato imprime sem cabeçalho da empresa se falhar

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

  const sortHead = createSortableHead([
    { key: 'nome',  label: 'Nome' },
    { key: 'qtd',   label: 'Lançamentos', cls: 'th-money' },
    { key: 'valor', label: 'Total',       cls: 'th-money' },
  ], {
    initialCol: 'valor',
    initialDir: 'desc',
    sortValue: (r, key) => {
      switch (key) {
        case 'nome':  return r.nome || ''
        case 'qtd':   return r.qtd
        case 'valor': return r.valor
        default:      return ''
      }
    },
    onSort: () => update(),
  })

  const reportWrap = el('div', {})

  function update() {
    reportWrap.replaceChildren(buildRelatorio({
      lancamentos, clientes, fornecedores, empresa, periodo, tipo, agrupador, sortHead,
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

// Mesmo documento visual do Recibo (cabeçalho da empresa, tabela, rodapé
// Eixo) — dá pra imprimir ou salvar em PDF e mandar pro fornecedor/cliente,
// igual já se faz com o recibo de venda.
function abrirDrillDownModal(grupo, { tipoMeta, agrupador, periodo, empresa, clientesMap, fornecedoresMap }) {
  openModal({
    title: grupo.nome,
    size: 'lg',
    renderBody: (body) => {
      const itensComContato = agrupador === 'categoria'
        ? grupo.itens.map(l => ({ ...l, contato: nomeVivo(l.contatoId, l.contato, l.contatoTipo === 'fornecedor' ? fornecedoresMap : clientesMap) }))
        : grupo.itens

      const dados = montarDadosExtrato({
        empresa,
        titulo: grupo.nome,
        tipoLabel: tipoMeta.label,
        periodoLabel: periodoLabel(periodo.de, periodo.ate),
        itens: itensComContato,
      })

      renderExtratoPreview(body, dados)
    },
    footer: (close, footerEl) => {
      const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
      fecharBtn.addEventListener('click', close)
      footerEl.append(fecharBtn, criarBotaoImprimir())
    },
  })
}

function buildRelatorio({ lancamentos, clientes, fornecedores, empresa, periodo, tipo, agrupador, sortHead, busca }) {
  const tipoMeta = TIPO_META[tipo]
  const clientesMap = buildNomeMap(clientes)
  const fornecedoresMap = buildNomeMap(fornecedores)

  const doPeriodo = lancamentosNoPeriodo(lancamentos, periodo.de, periodo.ate).filter(l => l.tipo === tipo)
  let ranking = agrupar(doPeriodo, agrupador, clientesMap, fornecedoresMap)
  if (busca) ranking = ranking.filter(r => r.nome.toLowerCase().includes(busca))
  ranking = sortHead.sort(ranking)

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
    row.addEventListener('click', () => abrirDrillDownModal(r, { tipoMeta, agrupador, periodo, empresa, clientesMap, fornecedoresMap }))
    tbody.appendChild(row)
  })

  const table = el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table' },
      el('thead', {}, el('tr', {}, ...sortHead.ths)),
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
