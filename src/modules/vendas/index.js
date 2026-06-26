import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeVendas } from './service.js'
import { renderVendasList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando vendas...'))
  _init(container)
}

async function _init(container) {
  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeVendas(
    vendas => {
      if (firstLoad) {
        firstLoad = false
        listController = renderVendasList(container, vendas)
      } else {
        listController?.update(vendas)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar vendas.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
