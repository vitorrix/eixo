import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeCompras } from './service.js'
import { renderComprasList } from './list.js'
import { getOperacoes } from '../configuracoes/service.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando compras...'))
  _init(container)
}

async function _init(container) {
  let fornecedores = [], produtosCatalogo = [], clientes = [], formasPagamento = []
  try {
    const [fSnap, pSnap, cSnap, operacoes] = await Promise.all([
      getDocs(query(collection(db, 'fornecedores'), orderBy('nameLower'))),
      getDocs(query(collection(db, 'produtos'),     orderBy('nameLower'))),
      getDocs(query(collection(db, 'clientes'),     orderBy('nameLower'))),
      getOperacoes(),
    ])
    fornecedores     = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    produtosCatalogo = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    clientes         = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    formasPagamento  = operacoes.formasPagamento || []
  } catch (err) {
    console.error(err)
  }

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeCompras(
    compras => {
      if (firstLoad) {
        firstLoad = false
        listController = renderComprasList(container, compras, { fornecedores, produtosCatalogo, clientes, formasPagamento })
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
