import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { maskCNPJ, maskPhone, linhasEndereco } from '../../shared/utils/formatters.js'
import { createRelatorioActions } from '../../shared/components/RelatorioActions.js'
import { getEmpresa } from '../configuracoes/service.js'
import { renderDRE } from './dre.js'
import { renderVendasDetalhadas } from './vendasDetalhadas.js'
import { renderVendasPorProduto } from './vendasPorProduto.js'
import { renderAbcProdutos } from './abcProdutos.js'
import { renderFluxoFinanceiro } from './fluxoFinanceiro.js'
import { renderFluxoCaixaPeriodico } from './fluxoCaixaPeriodico.js'
import { renderPorCategoriaContato } from './porCategoriaContato.js'
import { renderEgestor } from './egestor.js'

const ICON_PATHS = {
  trendUp:  ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  barChart: ['M18 20V10M12 20V4M6 20v-6'],
  tag:      ['M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z', 'M7 7h.01'],
  ranking:  ['M7 20V10M13 20V4M19 20v-6', 'M2 20h20'],
  cifrao:   ['M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'],
  calendar: ['M8 2v4M16 2v4M3 10h18', 'M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z'],
  folder:   ['M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z'],
  upload:   ['M12 3v12', 'M7 8l5-5 5 5', 'M5 21h14'],
}

function buildIcon(key, color) {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: color,
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '22', height: '22',
  })
  for (const d of ICON_PATHS[key] || []) svg.appendChild(svgEl('path', { d }))
  return svg
}

// Lista de relatórios disponíveis — adicionar aqui conforme novos forem
// entrando (ex: comissão por vendedor...).
const RELATORIOS = [
  { key: 'vendas-detalhadas', label: 'Vendas Detalhadas',        sub: 'Margem de cada venda',              icon: 'trendUp',  color: '#6366f1', render: renderVendasDetalhadas },
  { key: 'dre',               label: 'DRE',                      sub: 'Resultado do período',               icon: 'barChart', color: '#10B981', render: renderDRE },
  { key: 'vendas-produtos',   label: 'Vendas por Produto',       sub: 'Ranking de produtos vendidos',       icon: 'tag',      color: '#ec4899', render: renderVendasPorProduto },
  { key: 'abc-produtos',      label: 'ABC de Produtos',          sub: 'Curva ABC de faturamento',           icon: 'ranking',  color: '#f59e0b', render: renderAbcProdutos },
  { key: 'fluxo-financeiro',  label: 'Fluxo Financeiro',         sub: 'Receitas x despesas por categoria',  icon: 'cifrao',   color: '#3b82f6', render: renderFluxoFinanceiro },
  { key: 'fluxo-caixa',       label: 'Fluxo de Caixa Periódico', sub: 'Evolução mês a mês',                  icon: 'calendar', color: '#8b5cf6', render: renderFluxoCaixaPeriodico },
  { key: 'por-categoria',     label: 'Por Categoria/Contato',    sub: 'Quanto gastou com quem',              icon: 'folder',   color: '#14b8a6', render: renderPorCategoriaContato },
  { key: 'egestor',           label: 'E-gestor',                 sub: 'Importação do sistema anterior',      icon: 'upload',   color: '#64748b', render: renderEgestor },
]

// Cabeçalho que só aparece na impressão: identifica a empresa, qual relatório é
// e quando foi gerado — o período já vem do próprio seletor, que a CSS de
// impressão mantém visível.
function buildPrintEmpresa(empresa) {
  const nome = empresa?.razao || empresa?.fantasia || ''
  const contato = [empresa?.tel1 ? maskPhone(empresa.tel1) : '', empresa?.email || ''].filter(Boolean).join(' · ')
  return el('div', { class: 'relatorio-print-empresa' },
    nome ? el('strong', {}, nome) : null,
    ...linhasEndereco(empresa?.address, { comBairro: false }).map(l => el('span', {}, l)),
    empresa?.cnpj ? el('span', {}, `CNPJ: ${maskCNPJ(empresa.cnpj)}`) : null,
    contato ? el('span', {}, contato) : null,
  )
}

export function render(container) {
  let activeCleanup = null

  const printEmpresaWrap = el('div', {})
  const printTitulo = el('h3', { class: 'relatorio-print-titulo' })
  const printGerado = el('span', { class: 'relatorio-print-gerado' })
  const printHeader = el('div', { class: 'relatorio-print-header' },
    printEmpresaWrap,
    el('div', { class: 'relatorio-print-meta' }, printTitulo, printGerado),
  )

  // Empresa é opcional no cabeçalho — se falhar, o relatório imprime igual,
  // só sem os dados do topo.
  getEmpresa()
    .then(empresa => mount(printEmpresaWrap, buildPrintEmpresa(empresa)))
    .catch(err => console.error('Erro ao carregar dados da empresa (cabeçalho de impressão):', err))

  const actions = createRelatorioActions({
    onBeforePrint: () => {
      printGerado.textContent = `Gerado em ${new Date().toLocaleString('pt-BR')}`
    },
  })

  const bodyWrap = el('div', {})

  // Tela inicial: cards de acesso rápido (mesmo padrão do Dashboard) em vez
  // da fileira de abas — 8 relatórios numa linha só tinha virado bagunça,
  // quebrando o texto no meio ("Vendas por / Produto").
  function renderHub() {
    if (typeof activeCleanup === 'function') activeCleanup()
    activeCleanup = null
    actions.style.display = 'none'

    const cards = RELATORIOS.map(r => {
      const card = el('div', { class: 'dash-card' },
        el('div', { class: 'dash-card-icon-wrap', style: `background:${r.color}1a` }, buildIcon(r.icon, r.color)),
        el('div', {},
          el('div', { class: 'dash-card-label' }, r.label),
          el('div', { class: 'dash-card-sub' }, r.sub),
        ),
      )
      card.addEventListener('click', () => renderRelatorio(r.key))
      return card
    })

    mount(bodyWrap, el('div', { class: 'dashboard-cards' }, ...cards))
  }

  function renderRelatorio(key) {
    if (typeof activeCleanup === 'function') activeCleanup()
    activeCleanup = null

    const relatorio = RELATORIOS.find(r => r.key === key)
    printTitulo.textContent = relatorio.label
    actions.style.display = ''

    const voltarBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm relatorio-voltar' }, '← Relatórios')
    voltarBtn.addEventListener('click', renderHub)

    const tabContent = el('div', { class: 'config-tab-content' })
    mount(bodyWrap,
      el('div', { class: 'relatorio-header-ativo' }, voltarBtn, el('h3', {}, relatorio.label)),
      tabContent,
    )
    const cleanup = relatorio.render(tabContent)
    if (typeof cleanup === 'function') activeCleanup = cleanup
  }

  mount(container,
    printHeader,
    el('div', { class: 'page-header' }, el('h2', {}, 'Relatórios')),
    bodyWrap,
    actions,
  )
  renderHub()

  return () => { if (typeof activeCleanup === 'function') activeCleanup() }
}
