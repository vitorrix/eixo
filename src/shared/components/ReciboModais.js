import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../utils/dom.js'
import { openModal } from './Modal.js'
import { toastSuccess, toastError } from './Toast.js'
import {
  montarDadosRecibo, montarDadosReciboVendaAvulsa, montarDadosReciboHistorico, renderReciboPreview,
  garantirNumeroRecibo, toWhatsappNumber, enviarReciboFila, FILA_STATUS_LABEL, criarBotaoImprimir,
  imprimirReciboAutomaticamente,
} from './Recibo.js'
import { patchPedido } from '../../modules/pedidos/service.js'
import { patchVenda } from '../../modules/vendas/service.js'

// Recibo de uma Venda: vinda de pedido, o recibo é o do pedido inteiro (todos
// os itens juntos, igual à tela de Pedidos). Venda avulsa: recibo de item
// único, puxando os dados do aparelho da Compra mais recente com esse
// produtoId (melhor esforço — se houver mais de uma compra em aberto do mesmo
// produto, pode não bater com a unidade exata vendida).
// Usado pela tela de Vendas e pelo Histórico do cliente.
async function montarReciboVenda(venda, { empresa, usuariosPorUid, resolverCliente }) {
  if (venda.pedidoId) {
    const snap = await getDoc(doc(db, 'pedidos', venda.pedidoId))
    if (!snap.exists()) throw new Error('Pedido de origem não encontrado.')
    const pedido = { id: snap.id, ...snap.data() }
    const numero = await garantirNumeroRecibo(pedido, patchPedido)
    const cliente = resolverCliente(pedido.clienteId, pedido.cliente)
    const vendedorNome = usuariosPorUid[pedido.criadoPor] || '—'
    const comprasSnap = await getDocs(query(collection(db, 'compras'), where('pedidoId', '==', pedido.id)))
    const comprasPedido = comprasSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    return { dados: montarDadosRecibo(pedido, { numero, empresa, cliente, vendedorNome, comprasPedido }), tipo: 'pedido', entidade: pedido }
  }

  const numero = await garantirNumeroRecibo(venda, patchVenda)
  const cliente = resolverCliente(venda.clienteId, venda.cliente)
  const vendedorNome = usuariosPorUid[venda.criadoPor] || '—'
  let compra = null
  if (venda.produtoId) {
    const snap = await getDocs(query(collection(db, 'compras'), where('produtoId', '==', venda.produtoId)))
    const candidatas = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.observacoes)
      .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
    compra = candidatas[0] || null
  }
  return {
    dados: montarDadosReciboVendaAvulsa(venda, { numero, empresa, cliente, vendedorNome, compra }),
    tipo: 'venda', entidade: venda,
  }
}

// resolverCliente(id, nome) -> cadastro do cliente (telefone/endereço) ou undefined
export function abrirReciboDaVenda(venda, { empresa = {}, usuariosPorUid = {}, resolverCliente, autoImprimir = false }) {
  openModal({
    title: 'Recibo',
    size:  'lg',
    renderBody: (body, closeModal) => {
      mount(body, el('div', { class: 'loading' }, 'Montando recibo...'))

      montarReciboVenda(venda, { empresa, usuariosPorUid, resolverCliente }).then(({ dados, tipo, entidade }) => {
        const previewWrap = el('div', {})
        renderReciboPreview(previewWrap, dados)
        if (autoImprimir) imprimirReciboAutomaticamente(previewWrap)

        const cliente = tipo === 'pedido'
          ? resolverCliente(entidade.clienteId, entidade.cliente)
          : resolverCliente(venda.clienteId, venda.cliente)
        const temTelefone = !!toWhatsappNumber(cliente?.phone)

        const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fecharBtn.addEventListener('click', () => { unsubFila?.(); closeModal() })

        const imprimirBtn = criarBotaoImprimir()

        const statusEl = el('span', { class: 'text-muted', style: 'margin-left:10px;font-size:13px' })

        let unsubFila = null
        const enviarBtn = el('button', { type: 'button', class: 'btn btn-success' }, 'Enviar por WhatsApp')
        enviarBtn.addEventListener('click', async () => {
          enviarBtn.disabled = true
          try {
            const telefone = toWhatsappNumber(cliente?.phone)
            const ref = await enviarReciboFila({
              dados, telefone,
              pedidoId: tipo === 'pedido' ? entidade.id : null,
              vendaId:  tipo === 'venda'  ? entidade.id : null,
            })
            await patchVenda(venda.id, { reciboEmitido: true })
            toastSuccess('Enviado para a fila — o bot manda pro cliente em instantes.')
            statusEl.textContent = FILA_STATUS_LABEL.pendente
            unsubFila = onSnapshot(ref, snap => {
              const fila = snap.data()
              if (!fila) return
              statusEl.textContent = FILA_STATUS_LABEL[fila.status] || fila.status
              if (fila.status === 'erro') enviarBtn.disabled = false
            })
          } catch (err) {
            console.error(err)
            toastError(err.message || 'Erro ao enviar recibo.')
            enviarBtn.disabled = false
          }
        })
        if (!temTelefone) {
          enviarBtn.disabled = true
          statusEl.textContent = 'Cliente sem telefone cadastrado.'
        }

        mount(body,
          previewWrap,
          el('div', { class: 'modal-footer no-print' }, fecharBtn, imprimirBtn, enviarBtn, statusEl)
        )
      }).catch(err => {
        console.error(err)
        mount(body, el('p', { class: 'text-muted' }, 'Erro ao montar o recibo.'))
      })
    },
  })
}

// Recibo de venda do sistema anterior (E-gestor, coleção só leitura
// vendasHistoricas). cliente = cadastro do Eixo com o mesmo nome (ou undefined).
export function abrirReciboHistorico(venda, { empresa = {}, cliente }) {
  openModal({
    title: 'Recibo',
    size: 'lg',
    renderBody: (body, closeModal) => {
      const dados = montarDadosReciboHistorico(venda, { empresa, cliente })
      const previewWrap = el('div', {})
      renderReciboPreview(previewWrap, dados)

      const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
      fecharBtn.addEventListener('click', closeModal)
      const imprimirBtn = criarBotaoImprimir()

      const telefone = toWhatsappNumber(cliente?.phone)
      const statusEl = el('span', { class: 'text-muted', style: 'margin-left:10px;font-size:13px' })
      const enviarBtn = el('button', { type: 'button', class: 'btn btn-success' }, 'Enviar por WhatsApp')
      enviarBtn.addEventListener('click', async () => {
        enviarBtn.disabled = true
        try {
          await enviarReciboFila({ dados, telefone })
          statusEl.textContent = FILA_STATUS_LABEL.pendente
        } catch (err) {
          console.error(err)
          statusEl.textContent = 'Erro ao enviar.'
          enviarBtn.disabled = false
        }
      })
      if (!telefone) {
        enviarBtn.disabled = true
        statusEl.textContent = 'Cliente sem telefone cadastrado no Eixo.'
      }

      mount(body,
        previewWrap,
        el('div', { class: 'modal-footer no-print' }, fecharBtn, imprimirBtn, enviarBtn, statusEl)
      )
    },
  })
}
