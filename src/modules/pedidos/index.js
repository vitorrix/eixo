import { collection, getDocs, getDoc, doc, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { subscribePedidos } from './service.js'
import { renderPedidoList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando pedidos...'))
  _init(container)
}

async function _init(container) {
  let clientes = [], fornecedores = [], operacoes = { formasPagamento: [], contas: [] }

  try {
    const [cSnap, fSnap, opSnap] = await Promise.all([
      getDocs(query(collection(db, 'clientes'),     orderBy('nameLower'))),
      getDocs(query(collection(db, 'fornecedores'), orderBy('nameLower'))),
      getDoc(doc(db, 'configuracoes', 'operacoes')),
    ])
    clientes     = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    fornecedores = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (opSnap.exists()) operacoes = opSnap.data()
  } catch (err) {
    console.error('Erro ao carregar dependências:', err)
  }

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribePedidos(
    pedidos => {
      if (firstLoad) {
        firstLoad = false
        listController = renderPedidoList(container, pedidos, { clientes, fornecedores, operacoes })
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
