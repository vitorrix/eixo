import { el, mount } from '../../shared/utils/dom.js'
import { renderDRE } from './dre.js'
import { renderVendasPorProduto } from './vendasPorProduto.js'
import { renderFluxoFinanceiro } from './fluxoFinanceiro.js'
import { renderFluxoCaixaPeriodico } from './fluxoCaixaPeriodico.js'

// Lista de relatórios disponíveis — adicionar aqui conforme novos forem
// entrando (ex: ABC de produtos vendidos, comissão por vendedor...).
const RELATORIOS = [
  { key: 'dre',              label: 'DRE',                     render: renderDRE },
  { key: 'vendas-produtos',  label: 'Vendas por Produto',      render: renderVendasPorProduto },
  { key: 'fluxo-financeiro', label: 'Fluxo Financeiro',        render: renderFluxoFinanceiro },
  { key: 'fluxo-caixa',      label: 'Fluxo de Caixa Periódico', render: renderFluxoCaixaPeriodico },
]

export function render(container) {
  let activeCleanup = null

  const tabBtns = RELATORIOS.map(r => {
    const btn = el('button', { type: 'button', class: 'config-tab-btn' }, r.label)
    btn.addEventListener('click', () => switchTab(r.key))
    return btn
  })
  const tabBar = el('div', { class: 'config-tab-bar' }, ...tabBtns)
  const tabContent = el('div', { class: 'config-tab-content' })

  function switchTab(key) {
    if (typeof activeCleanup === 'function') activeCleanup()
    activeCleanup = null
    tabBtns.forEach((btn, i) => btn.classList.toggle('active', RELATORIOS[i].key === key))
    tabContent.replaceChildren()
    const relatorio = RELATORIOS.find(r => r.key === key)
    const cleanup = relatorio.render(tabContent)
    if (typeof cleanup === 'function') activeCleanup = cleanup
  }

  mount(container,
    el('div', { class: 'page-header' }, el('h2', {}, 'Relatórios')),
    tabBar,
    tabContent
  )
  switchTab(RELATORIOS[0].key)

  return () => { if (typeof activeCleanup === 'function') activeCleanup() }
}
