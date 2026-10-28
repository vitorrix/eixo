import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeDesejos, subscribeEstoque } from './service.js'
import { renderDesejos } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando desejos...'))

  let controller = null
  let desejos = null
  let unidades = []
  let estoqueIndisponivel = false

  const atualizar = () => {
    if (desejos === null) return
    if (!controller) controller = renderDesejos(container, desejos, unidades, estoqueIndisponivel)
    else controller.update(desejos, unidades, estoqueIndisponivel)
  }

  const unsubDesejos = subscribeDesejos(
    lista => { desejos = lista; atualizar() },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar a lista de desejos.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )
  const unsubEstoque = subscribeEstoque(
    lista => { unidades = lista; estoqueIndisponivel = false; atualizar() },
    err => { console.error('Estoque indisponível:', err); estoqueIndisponivel = true; atualizar() }
  )

  return () => { unsubDesejos(); unsubEstoque() }
}
