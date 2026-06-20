import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeProdutos } from './service.js'
import { renderProdutoList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando produtos...'))

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeProdutos(
    produtos => {
      if (firstLoad) {
        firstLoad = false
        listController = renderProdutoList(container, produtos)
      } else {
        listController?.update(produtos)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar produtos.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
