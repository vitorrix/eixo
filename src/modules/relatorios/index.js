import { el, mount } from '../../shared/utils/dom.js'
import { maskCNPJ, maskPhone, linhasEndereco } from '../../shared/utils/formatters.js'
import { createRelatorioActions } from '../../shared/components/RelatorioActions.js'
import { getEmpresa } from '../configuracoes/service.js'
import { renderDRE } from './dre.js'
import { renderVendasDetalhadas } from './vendasDetalhadas.js'
import { renderVendasPorProduto } from './vendasPorProduto.js'
import { renderAbcProdutos } from './abcProdutos.js'
import { renderFluxoFinanceiro } from './fluxoFinanceiro.js'
import { renderFluxoCaixaPeriodico } from './fluxoCaixaPeriodico.js'

// Lista de relatórios disponíveis — adicionar aqui conforme novos forem
// entrando (ex: comissão por vendedor...).
const RELATORIOS = [
  { key: 'vendas-detalhadas', label: 'Vendas Detalhadas',       render: renderVendasDetalhadas },
  { key: 'dre',               label: 'DRE',                     render: renderDRE },
  { key: 'vendas-produtos',   label: 'Vendas por Produto',      render: renderVendasPorProduto },
  { key: 'abc-produtos',      label: 'ABC de Produtos',         render: renderAbcProdutos },
  { key: 'fluxo-financeiro',  label: 'Fluxo Financeiro',        render: renderFluxoFinanceiro },
  { key: 'fluxo-caixa',       label: 'Fluxo de Caixa Periódico', render: renderFluxoCaixaPeriodico },
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

  const tabBtns = RELATORIOS.map(r => {
    const btn = el('button', { type: 'button', class: 'config-tab-btn' }, r.label)
    btn.addEventListener('click', () => switchTab(r.key))
    return btn
  })
  const tabBar = el('div', { class: 'config-tab-bar' }, ...tabBtns)
  const tabContent = el('div', { class: 'config-tab-content' })

  const actions = createRelatorioActions({
    onBeforePrint: () => {
      printGerado.textContent = `Gerado em ${new Date().toLocaleString('pt-BR')}`
    },
  })

  function switchTab(key) {
    if (typeof activeCleanup === 'function') activeCleanup()
    activeCleanup = null
    tabBtns.forEach((btn, i) => btn.classList.toggle('active', RELATORIOS[i].key === key))
    tabContent.replaceChildren()
    const relatorio = RELATORIOS.find(r => r.key === key)
    printTitulo.textContent = relatorio.label
    const cleanup = relatorio.render(tabContent)
    if (typeof cleanup === 'function') activeCleanup = cleanup
  }

  mount(container,
    printHeader,
    el('div', { class: 'page-header' }, el('h2', {}, 'Relatórios')),
    tabBar,
    tabContent,
    actions,
  )
  switchTab(RELATORIOS[0].key)

  return () => { if (typeof activeCleanup === 'function') activeCleanup() }
}
