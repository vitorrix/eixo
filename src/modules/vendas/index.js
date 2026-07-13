import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribeVendas } from './service.js'
import { renderVendasList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando vendas...'))
  _init(container)
}

async function _init(container) {
  let produtosCatalogo = [], clientes = []
  try {
    const [pSnap, cSnap] = await Promise.all([
      getDocs(query(collection(db, 'produtos'), orderBy('nameLower'))),
      getDocs(query(collection(db, 'clientes'), orderBy('nameLower'))),
    ])
    produtosCatalogo = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    clientes         = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error(err)
  }

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeVendas(
    vendas => {
      if (firstLoad) {
        firstLoad = false
        listController = renderVendasList(container, vendas, { produtosCatalogo, clientes })
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
