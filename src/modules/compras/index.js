import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeCompras } from './service.js'
import { renderComprasList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando compras...'))
  _init(container)
}

async function _init(container) {
  let fornecedores = []
  try {
    const snap = await getDocs(query(collection(db, 'fornecedores'), orderBy('nameLower')))
    fornecedores = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error(err)
  }

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeCompras(
    compras => {
      if (firstLoad) {
        firstLoad = false
        listController = renderComprasList(container, compras, { fornecedores })
      } else {
        listController?.update(compras)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar compras.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
