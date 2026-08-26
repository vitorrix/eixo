import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeLeads } from './service.js'
import { renderLeadsNovos } from './novos.js'
import { renderLeadsFollowup } from './followup.js'
import { renderLeadsHistorico } from './historico.js'

// TODO: fase 2 - Instagram DM (mais uma aba/origem, mesma UI de triagem)

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando leads...'))

  let controllers = null
  let firstLoad = true

  const secNovos = el('div', { class: 'orc-section active' })
  const secFollowup = el('div', { class: 'orc-section' })
  const secHistorico = el('div', { class: 'orc-section' })

  const tabNovos = el('button', { type: 'button', class: 'config-tab-btn active' }, 'Novos Leads')
  const tabFollowup = el('button', { type: 'button', class: 'config-tab-btn' }, 'Em Follow-up')
  const tabHistorico = el('button', { type: 'button', class: 'config-tab-btn' }, 'Histórico')
  const abas = [[tabNovos, secNovos], [tabFollowup, secFollowup], [tabHistorico, secHistorico]]
  function ativar(tab, sec) {
    for (const [t, s] of abas) { t.classList.toggle('active', t === tab); s.classList.toggle('active', s === sec) }
  }
  tabNovos.addEventListener('click', () => ativar(tabNovos, secNovos))
  tabFollowup.addEventListener('click', () => ativar(tabFollowup, secFollowup))
  tabHistorico.addEventListener('click', () => ativar(tabHistorico, secHistorico))

  const unsubscribe = subscribeLeads(
    leads => {
      if (firstLoad) {
        firstLoad = false
        mount(container,
          el('div', { class: 'page-header' }, el('h2', {}, 'Leads')),
          el('div', { class: 'orc-tabs-center' }, el('div', { class: 'config-tab-bar' }, tabNovos, tabFollowup, tabHistorico)),
          secNovos, secFollowup, secHistorico,
        )
        controllers = {
          novos: renderLeadsNovos(secNovos, leads),
          followup: renderLeadsFollowup(secFollowup, leads),
          historico: renderLeadsHistorico(secHistorico, leads),
        }
      } else {
        controllers?.novos.update(leads)
        controllers?.followup.update(leads)
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
