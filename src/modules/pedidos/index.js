import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribePedidos } from './service.js'
import { renderPedidoList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando pedidos...'))

  let cancelled = false
  let unsubPedidos = null

  _init(container).then(unsub => {
    if (cancelled) unsub?.()   // navegou antes do init terminar: cancela já
    else unsubPedidos = unsub
  })

  return () => {
    cancelled = true
    unsubPedidos?.()
  }
}

async function _init(container) {
  let clientes = [], produtosCatalogo = [], fornecedores = []

  try {
    const [cSnap, pSnap, fSnap] = await Promise.all([
      getDocs(query(collection(db, 'clientes'),     orderBy('nameLower'))),
      getDocs(query(collection(db, 'produtos'),     orderBy('nameLower'))),
      getDocs(query(collection(db, 'fornecedores'), orderBy('nameLower'))),
    ])
    clientes         = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    produtosCatalogo = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    fornecedores     = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error('Erro ao carregar dependências:', err)
  }

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribePedidos(
    pedidos => {
      if (firstLoad) {
        firstLoad = false
        listController = renderPedidoList(container, pedidos, { clientes, produtosCatalogo, fornecedores })
      } else {
        listController?.update(pedidos)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar pedidos.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
