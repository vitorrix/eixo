import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeOfertas } from './service.js'
import { renderBuscaList } from './list.js'
import { criarBotaoRevisaoCores } from './revisaoCores.js'

export function render(container) {
  const loading = el('div', { class: 'loading' }, 'Carregando ofertas...')
  mount(container, loading)

  let listController = null
  let firstLoad = true
  let revisao = null

  const unsubscribe = subscribeOfertas(
    (ofertas) => {
      if (firstLoad) {
        firstLoad = false
        loading.remove()
        listController = renderBuscaList(container, ofertas)
        // Botão da fila de revisão de cores, na barra do título
        revisao = criarBotaoRevisaoCores()
        container.querySelector('.toolbar')?.appendChild(revisao.el)
      } else {
        listController?.update(ofertas)
      }
    },
    (err) => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar ofertas.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return () => { unsubscribe?.(); revisao?.destroy() }
}
