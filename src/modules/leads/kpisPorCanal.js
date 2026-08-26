import { el, mount } from '../../shared/utils/dom.js'
import { canalDoLead, canalIcon } from './constants.js'

// Painel de números por canal (WhatsApp/Instagram) — reaproveitado no
// Histórico (com o recorte de período já aplicado antes de chegar aqui) e
// no Quadro (sem recorte, é a visão geral de tudo que já passou por ali).
function kpiCard(label, value) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: 'pedido-stat-value' }, String(value)),
  )
}

function painelCanal(titulo, canal, totalLabel) {
  const statsWrap = el('div', { class: 'pedidos-stats' })
  const painel = el('div', {},
    el('h4', { class: 'lead-board-section-title' }, canalIcon(canal), el('span', {}, titulo)),
    statsWrap,
  )
  return {
    painel,
    atualizar(lista) {
      statsWrap.replaceChildren(
        kpiCard(totalLabel, lista.length),
        kpiCard('Convertidos', lista.filter(l => l.status === 'convertido').length),
        kpiCard('Descartados', lista.filter(l => l.status === 'descartado').length),
        kpiCard('Sem resposta', lista.filter(l => l.status === 'sem_resposta').length),
      )
    },
  }
}

export function buildKpisPorCanal(container, leads, { totalLabel = 'Total' } = {}) {
  const wpp = painelCanal('WhatsApp', 'whatsapp', totalLabel)
  const ig = painelCanal('Instagram', 'instagram', totalLabel)
  mount(container, el('div', { class: 'lead-kpis-stack' }, wpp.painel, ig.painel))

  function refresh() {
    wpp.atualizar(leads.filter(l => canalDoLead(l) === 'whatsapp'))
    ig.atualizar(leads.filter(l => canalDoLead(l) === 'instagram'))
  }
  refresh()

  return { update(newLeads) { leads = newLeads; refresh() } }
}
