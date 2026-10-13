import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate, toNumero } from '../../shared/utils/formatters.js'
import { openModal } from '../../shared/components/Modal.js'
import { abrirReciboDaVenda, abrirReciboHistorico } from '../../shared/components/ReciboModais.js'
import { getEmpresa } from '../configuracoes/service.js'
import { isoLocal } from '../../shared/utils/periodo.js'

const ENTREGA_LABEL = {
  aguardando: 'Aguardando', retirada: 'Retirada', motoboy: 'Motoboy',
  correio: 'Correio', entregue: 'Entregue',
}

const PEDIDO_STATUS_LABEL = {
  negociando: 'Negociando', aguard_pgto: 'Aguardando pagamento', pago: 'Pago',
  pago_parcial: 'Pago parcial', motoboy: 'Motoboy', retirada: 'Retirada',
  correio: 'Correio', entregue: 'Entregue', cancelado: 'Cancelado',
}

function dataHora(ts) {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null
}

function dia(ts) {
  return ts?.toDate ? shortDate(isoLocal(ts.toDate())) : '—'
}

function millis(ts) {
  return ts?.toDate ? ts.toDate().getTime() : 0
}

function itensTexto(v) {
  const itens = Array.isArray(v.itens) && v.itens.length ? v.itens.map(i => i.produto) : [v.produto]
  return itens.filter(Boolean).join(' + ') || '—'
}

// Cada consulta falha em separado (permissão do módulo de origem, rede) — o
// histórico mostra o que conseguir carregar em vez de quebrar inteiro.
async function tentar(promessa, vazio = []) {
  try { return await promessa } catch (err) { console.error('Histórico do cliente:', err); return vazio }
}

async function carregarHistorico(cliente) {
  const col = nome => collection(db, nome)
  const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }))

  const [empresa, vendasId, vendasNome, pedidosId, pedidosNome, historicas, usuarios] = await Promise.all([
    tentar(getEmpresa(), {}),
    tentar(getDocs(query(col('vendas'), where('clienteId', '==', cliente.id))).then(docs)),
    // Venda antiga sem clienteId salvo: casa pelo nome (mesmo critério do recibo)
    tentar(getDocs(query(col('vendas'), where('cliente', '==', cliente.name))).then(docs)),
    tentar(getDocs(query(col('pedidos'), where('clienteId', '==', cliente.id))).then(docs)),
    tentar(getDocs(query(col('pedidos'), where('cliente', '==', cliente.name))).then(docs)),
    tentar(getDocs(query(col('vendasHistoricas'), where('cliente', '==', cliente.name))).then(docs)),
    tentar(getDocs(col('users')).then(docs)),
  ])

  const unicos = (...listas) => [...new Map(listas.flat().map(x => [x.id, x])).values()]
  const vendas = unicos(vendasId, vendasNome.filter(v => !v.clienteId))
  const pedidos = unicos(pedidosId, pedidosNome.filter(p => !p.clienteId))
  const usuariosPorUid = Object.fromEntries(usuarios.map(u => [u.id, u.name]))

  return { empresa, vendas, pedidos, historicas, usuariosPorUid }
}

function resumoCard(label, valor) {
  return el('div', { class: 'pedido-stat' },
    el('div', { class: 'pedido-stat-label' }, label),
    el('div', { class: 'pedido-stat-value' }, valor),
  )
}

function secao(titulo, ...filhos) {
  return el('div', { style: 'margin-top:22px' },
    el('p', { class: 'config-section-title' }, titulo),
    ...filhos,
  )
}

function tabela(cabecalhos, linhas) {
  return el('div', { class: 'table-wrapper' },
    el('table', { class: 'data-table' },
      el('thead', {}, el('tr', {}, ...cabecalhos.map(([label, cls]) => el('th', { class: cls || '' }, label)))),
      el('tbody', {}, ...linhas),
    )
  )
}

// Histórico completo do cliente: cadastro, compras (com recibo de cada uma),
// pedidos ainda sem venda e compras do sistema anterior (E-gestor).
export function abrirHistoricoCliente(cliente) {
  openModal({
    title: `Histórico — ${cliente.name}`,
    size: 'lg',
    renderBody: (body, close) => {
      mount(body, el('div', { class: 'loading' }, 'Carregando histórico...'))

      carregarHistorico(cliente).then(({ empresa, vendas, pedidos, historicas, usuariosPorUid }) => {
        const resolverCliente = () => cliente

        const comprasOrdenadas = [...vendas].sort((a, b) => millis(b.criadoEm) - millis(a.criadoEm))
        const historicasOrdenadas = [...historicas].sort((a, b) =>
          (b.dataConfirmacao || b.dataCriacao || '').localeCompare(a.dataConfirmacao || a.dataCriacao || ''))

        const totalAtual = vendas.reduce((s, v) => s + toNumero(v.valorVenda), 0)
        const totalAntigo = historicas.reduce((s, v) => s + toNumero(v.totalVenda), 0)
        const qtd = vendas.length + historicas.length
        const total = totalAtual + totalAntigo

        const ultimaAtual = comprasOrdenadas[0] ? dia(comprasOrdenadas[0].criadoEm) : null
        const ultimaAntiga = historicasOrdenadas[0]
          ? shortDate(historicasOrdenadas[0].dataConfirmacao || historicasOrdenadas[0].dataCriacao) : null
        const ultima = ultimaAtual || ultimaAntiga || '—'

        const resumo = el('div', { class: 'pedidos-stats' },
          resumoCard('Compras', String(qtd)),
          resumoCard('Total comprado', brl(total)),
          resumoCard('Ticket médio', qtd ? brl(total / qtd) : '—'),
          resumoCard('Última compra', ultima),
        )

        // ── Cadastro ──
        const criadoEm = dataHora(cliente.createdAt)
        const alterado = millis(cliente.updatedAt) - millis(cliente.createdAt) > 60 * 1000
        const criadoPor = usuariosPorUid[cliente.createdBy]
        const eventos = [
          criadoEm ? ['Cadastro criado', `${criadoEm}${criadoPor ? ' · por ' + criadoPor : ''}`] : null,
          alterado ? ['Última alteração do cadastro', dataHora(cliente.updatedAt)] : null,
        ].filter(Boolean)
        const cadastro = secao('Cadastro',
          eventos.length
            ? el('div', { class: 'detalhes-grid' }, ...eventos.map(([label, valor]) =>
                el('div', { class: 'detalhes-linha' },
                  el('span', { class: 'detalhes-label' }, label),
                  el('span', { class: 'detalhes-valor' }, valor))))
            : el('p', { class: 'text-muted' }, 'Sem data de cadastro registrada (cliente importado ou anterior ao registro).'),
          el('p', { class: 'text-muted', style: 'font-size:12px;margin-top:6px' },
            'O sistema guarda a data da última alteração do cadastro, não o detalhe de cada mudança.'),
        )

        // ── Compras (vendas) ──
        const linhasCompras = comprasOrdenadas.map(v => {
          const reciboBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, 'Recibo')
          reciboBtn.addEventListener('click', () =>
            abrirReciboDaVenda(v, { empresa, usuariosPorUid, resolverCliente }))
          return el('tr', {},
            el('td', { class: 'td-date' }, dia(v.criadoEm)),
            el('td', { class: 'td-name', title: itensTexto(v) }, itensTexto(v)),
            el('td', {}, v.formaPagamento || '—'),
            el('td', {}, ENTREGA_LABEL[v.statusEntrega] || v.statusEntrega || '—'),
            el('td', { class: 'td-money' }, brl(toNumero(v.valorVenda))),
            el('td', { class: 'col-actions' }, reciboBtn),
          )
        })
        const compras = secao(`Compras (${vendas.length})`,
          linhasCompras.length
            ? tabela([['Data'], ['Itens'], ['Pagamento'], ['Entrega'], ['Valor', 'th-money'], ['', 'col-actions']], linhasCompras)
            : el('p', { class: 'text-muted' }, 'Nenhuma compra registrada no Eixo.'),
        )

        // ── Pedidos que ainda não viraram venda ──
        const pedidosComVenda = new Set(vendas.map(v => v.pedidoId).filter(Boolean))
        const emAndamento = pedidos
          .filter(p => !pedidosComVenda.has(p.id) && p.status !== 'cancelado')
          .sort((a, b) => (b.dataContato || '').localeCompare(a.dataContato || ''))
        const pedidosSecao = emAndamento.length ? secao(`Pedidos em andamento (${emAndamento.length})`,
          tabela([['Data'], ['Itens'], ['Situação'], ['Valor', 'th-money']], emAndamento.map(p =>
            el('tr', {},
              el('td', { class: 'td-date' }, shortDate(p.dataContato)),
              el('td', { class: 'td-name' }, (p.produtos || []).map(i => i.nome).filter(Boolean).join(' + ') || '—'),
              el('td', {}, PEDIDO_STATUS_LABEL[p.status] || p.status || '—'),
              el('td', { class: 'td-money' }, brl(toNumero(p.valorNegociado))),
            ))),
        ) : null

        // ── Sistema anterior ──
        const antigas = historicasOrdenadas.length ? secao(`Compras no sistema anterior (${historicasOrdenadas.length})`,
          tabela([['Data'], ['Itens'], ['Pagamento'], ['Valor', 'th-money'], ['', 'col-actions']], historicasOrdenadas.map(h => {
            const reciboBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, 'Recibo')
            reciboBtn.addEventListener('click', () => abrirReciboHistorico(h, { empresa, cliente }))
            return el('tr', {},
              el('td', { class: 'td-date' }, shortDate(h.dataConfirmacao || h.dataCriacao)),
              el('td', { class: 'td-name' }, (h.itens || []).map(i => i.produto).filter(Boolean).join(', ') || '—'),
              el('td', {}, h.formaPagamento || '—'),
              el('td', { class: 'td-money' }, brl(toNumero(h.totalVenda))),
              el('td', { class: 'col-actions' }, reciboBtn),
            )
          })),
        ) : null

        const fechar = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fechar.addEventListener('click', close)

        mount(body, ...[resumo, cadastro, compras, pedidosSecao, antigas, el('div', { class: 'modal-footer' }, fechar)].filter(Boolean))
      }).catch(err => {
        console.error(err)
        mount(body, el('p', { class: 'text-muted' }, 'Erro ao carregar o histórico.'))
      })
    },
  })
}
