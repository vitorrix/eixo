import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeClientes } from './service.js'
import { renderClienteList } from './list.js'

export function render(container) {
  const loading = el('div', { class: 'loading' }, 'Carregando clientes...')
  mount(container, loading)

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeClientes(
    (clientes) => {
      if (firstLoad) {
        firstLoad = false
        loading.remove()
        listController = renderClienteList(container, clientes)
      } else {
        listController?.update(clientes)
      }
    },
    (err) => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar clientes.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  // Retorna cleanup para o router cancelar o listener ao sair da página
  return unsubscribe
}
