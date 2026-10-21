import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { getOperacoes } from '../configuracoes/service.js'
import { subscribeAcertos } from './service.js'
import { renderMotoboy } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando acertos...'))
  return _init(container)
}

async function _init(container) {
  let operacoes = { formasPagamento: [], contas: [], categorias: [] }
  let fornecedores = []
  try {
    const [op, fSnap] = await Promise.all([
      getOperacoes(),
      getDocs(query(collection(db, 'fornecedores'), orderBy('nameLower'))),
    ])
    operacoes = op
    fornecedores = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error('Erro ao carregar dados de apoio (contas/categorias/fornecedores):', err)
  }

  let controller = null
  let firstLoad = true

  const unsubscribe = subscribeAcertos(
    acertos => {
      if (firstLoad) {
        firstLoad = false
        controller = renderMotoboy(container, acertos, { fornecedores, operacoes })
      } else {
        controller?.update(acertos)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar acertos.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
