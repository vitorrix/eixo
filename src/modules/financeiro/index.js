import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { toastError } from '../../shared/components/Toast.js'
import { getOperacoes } from '../configuracoes/service.js'
import { subscribeFinanceiro } from './service.js'
import { renderFinanceiroList } from './list.js'

export function render(container) {
  mount(container, el('div', { class: 'loading' }, 'Carregando financeiro...'))
  return _init(container)
}

async function _init(container) {
  let operacoes = { formasPagamento: [], contas: [], categorias: [] }
  let clientes = [], fornecedores = []
  try {
    const [op, cSnap, fSnap] = await Promise.all([
      getOperacoes(),
      getDocs(query(collection(db, 'clientes'), orderBy('nameLower'))),
      getDocs(query(collection(db, 'fornecedores'), orderBy('nameLower'))),
    ])
    operacoes = op
    clientes = cSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    fornecedores = fSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.error('Erro ao carregar dados de apoio (contas/formas/categorias/contatos):', err)
  }

  let listController = null
  let firstLoad = true

  const unsubscribe = subscribeFinanceiro(
    lancamentos => {
      if (firstLoad) {
        firstLoad = false
        listController = renderFinanceiroList(container, lancamentos, { operacoes, clientes, fornecedores })
      } else {
        listController?.update(lancamentos)
      }
    },
    err => {
      console.error(err)
      mount(container, el('p', { class: 'text-muted' }, 'Erro ao carregar financeiro.'))
      toastError('Falha na conexão com o banco de dados.')
    }
  )

  return unsubscribe
}
