import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeLeads } from './service.js'
import { renderLeadsBoard } from './board.js'
import { renderLeadsHistorico } from './historico.js'

// TODO: fase 2 - Instagram DM (mais uma origem entrando no mesmo quadro)

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando leads...'))

  let controllers = null
  let firstLoad = true

  const secQuadro = el('div', { class: 'orc-section active' })
  const secHistorico = el('div', { class: 'orc-section' })

  const tabQuadro = el('button', { type: 'button', class: 'config-tab-btn active' }, 'Quadro')
  const tabHistorico = el('button', { type: 'button', class: 'config-tab-btn' }, 'Histórico')
  const abas = [[tabQuadro, secQuadro], [tabHistorico, secHistorico]]
  function ativar(tab, sec) {
    for (const [t, s] of abas) { t.classList.toggle('active', t === tab); s.classList.toggle('active', s === sec) }
  }
  tabQuadro.addEventListener('click', () => ativar(tabQuadro, secQuadro))
  tabHistorico.addEventListener('click', () => ativar(tabHistorico, secHistorico))

  const unsubscribe = subscribeLeads(
    leads => {
      if (firstLoad) {
        firstLoad = false
        mount(container,
          el('div', { class: 'page-header' }, el('h2', {}, 'Leads')),
          el('div', { class: 'orc-tabs-center' }, el('div', { class: 'config-tab-bar' }, tabQuadro, tabHistorico)),
          secQuadro, secHistorico,
        )
        controllers = {
          quadro: renderLeadsBoard(secQuadro, leads),
          historico: renderLeadsHistorico(secHistorico, leads),
        }
      } else {
        controllers?.quadro.update(leads)
        controllers?.historico.update(leads)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar leads.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
