import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeTarefas } from './service.js'
import { renderTarefasList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando tarefas...'))

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeTarefas(
    tarefas => {
      if (firstLoad) {
        firstLoad = false
        listController = renderTarefasList(container, tarefas)
      } else {
        listController?.update(tarefas)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar tarefas.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
