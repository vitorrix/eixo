import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeFornecedores } from './service.js'
import { renderFornecedorList } from './list.js'

export function render(container) {
  const loading = el('div', { class: 'loading' }, 'Carregando fornecedores...')
  mount(container, loading)

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeFornecedores(
    (fornecedores) => {
      if (firstLoad) {
        firstLoad = false
        loading.remove()
        listController = renderFornecedorList(container, fornecedores)
      } else {
        listController?.update(fornecedores)
      }
    },
    (err) => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar fornecedores.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
