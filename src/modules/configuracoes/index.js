import { el, mount } from '../../shared/utils/dom.js'
import { getEmpresa, getOperacoes } from './service.js'
import { renderTabEmpresa } from './tabEmpresa.js'
import { renderTabFormasPagamento } from './tabFormasPagamento.js'
import { renderTabContas } from './tabContas.js'
import { toastError } from '../../shared/components/Toast.js'

const TABS = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'formas',  label: 'Formas de Pagamento' },
  { key: 'contas',  label: 'Contas' },
]

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando configurações...'))
  _load(container)
}

async function _load(container) {
  let empresa, operacoes
  try {
    ;[empresa, operacoes] = await Promise.all([getEmpresa(), getOperacoes()])
  } catch (err) {
    console.error(err)
    mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar configurações.'))
    toastError('Falha ao carregar configurações.')
    return
  }

  const state = { empresa, operacoes }
  let activeKey = 'empresa'

  const tabBtns = TABS.map(t => {
    const btn = el('button', { type: 'button', class: 'config-tab-btn' }, t.label)
    btn.addEventListener('click', () => switchTab(t.key))
    return btn
  })

  const tabBar     = el('div', { class: 'config-tab-bar' }, ...tabBtns)
  const tabContent = el('div', { class: 'config-tab-content' })

  mount(container, tabBar, tabContent)

  function switchTab(key) {
    activeKey = key
    tabBtns.forEach((btn, i) => btn.classList.toggle('active', TABS[i].key === key))
    tabContent.replaceChildren()
    if (key === 'empresa') {
      renderTabEmpresa(tabContent, state.empresa, saved => { state.empresa = saved })
    } else if (key === 'formas') {
      renderTabFormasPagamento(tabContent, state.operacoes, saved => { state.operacoes = saved })
    } else if (key === 'contas') {
      renderTabContas(tabContent, state.operacoes, saved => { state.operacoes = saved })
    }
  }

  switchTab('empresa')
}
