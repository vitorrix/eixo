import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { getCurrentProfile } from '../../auth/session.js'
import { el, mount } from '../utils/dom.js'
import { brl, fullDate, maskCEP, maskPhone } from '../utils/formatters.js'
import { proximoNumeroRecibo } from '../../modules/configuracoes/service.js'
import { produtoLabel } from '../../modules/pedidos/service.js'

const PAG_TEXTO = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', link: 'Link' }
const PAID_STATUSES = new Set(['pago', 'motoboy', 'retirada', 'correio', 'entregue'])

export const FILA_STATUS_LABEL = { pendente: 'Na fila de envio...', enviado: '✅ Enviado.', erro: '❌ Erro ao enviar.' }

export function toWhatsappNumber(phoneDigits) {
  const d = (phoneDigits || '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('55') && d.length > 11 ? d : `55${d}`
}

// Grava o pedido de envio na fila (recibosFila) — o bot do WhatsApp escuta essa
// coleção e manda o PDF de verdade. pedidoId/vendaId identificam a origem (só
// um dos dois é preenchido), útil pra rastrear de onde veio o envio.
export async function enviarReciboFila({ dados, telefone, pedidoId = null, vendaId = null }) {
  const { uid } = getCurrentProfile()
  return addDoc(collection(db, 'recibosFila'), {
    pedidoId, vendaId,
    numero:    dados.numero,
    telefone,
    dados,
    status:    'pendente',
    criadoEm:  serverTimestamp(),
    criadoPor: uid,
  })
}

function linhasEndereco(addr, { comBairro = true } = {}) {
  if (!addr) return []
  const linhas = []
  const l1 = [addr.logradouro, addr.numero].filter(Boolean).join(', ') + (addr.complemento ? ` - ${addr.complemento}` : '')
  if (l1.trim()) linhas.push(l1)
  if (comBairro && addr.bairro) linhas.push(addr.bairro)
  const cidadeUf = [addr.cidade, addr.estado].filter(Boolean).join(' - ')
  if (cidadeUf) linhas.push(addr.cep ? `${cidadeUf} - CEP ${maskCEP(addr.cep)}` : cidadeUf)
  else if (addr.cep) linhas.push(`CEP ${maskCEP(addr.cep)}`)
  return linhas
}

function montarEmpresa(empresa) {
  return {
    razao:          empresa?.razao    || '',
    fantasia:       empresa?.fantasia || '',
    cnpj:           empresa?.cnpj     || '',
    tel1:           empresa?.tel1 ? maskPhone(empresa.tel1) : '',
    tel2:           empresa?.tel2 ? maskPhone(empresa.tel2) : '',
    email:          empresa?.email    || '',
    enderecoLinhas: linhasEndereco(empresa?.address, { comBairro: false }),
  }
}

function montarCliente(nome, cliente) {
  return {
    nome:           nome || '',
    telefone:       cliente?.phone ? maskPhone(cliente.phone) : '',
    email:          cliente?.email || '',
    enderecoLinhas: linhasEndereco(cliente?.address),
  }
}

// Garante um número sequencial de recibo pra qualquer entidade (Pedido ou Venda
// avulsa) — se já tem, não gera outro; se não, pega o próximo do contador
// compartilhado (configuracoes/contadores) e grava de volta via patchFn.
export async function garantirNumeroRecibo(entidade, patchFn) {
  if (entidade.numeroRecibo) return entidade.numeroRecibo
  const numero = await proximoNumeroRecibo()
  await patchFn(entidade.id, { numeroRecibo: numero })
  entidade.numeroRecibo = numero
  return numero
}

// Cada produto do pedido vira um item; cada acessório vira um item "brinde" (preço
// e desconto não são rastreados por acessório hoje, então entra a R$ 0 — simplificação
// a refinar depois se quisermos casar o preço com o catálogo).
function montarItensPedido(pedido) {
  const itens = []
  ;(pedido.produtos || []).forEach(p => {
    itens.push({ descricao: produtoLabel(p), precoUnit: p.valor || 0, quant: 1, desconto: 0, total: p.valor || 0 })
    ;(p.acessorios || []).forEach(nome => {
      itens.push({ descricao: nome, precoUnit: 0, quant: 1, desconto: 0, total: 0 })
    })
  })
  return itens
}

// Monta o objeto de dados do recibo de um Pedido — mesma estrutura usada no
// preview (HTML) e gravada na fila (recibosFila) pro bot montar o PDF de verdade.
export function montarDadosRecibo(pedido, { numero, empresa, cliente, vendedorNome }) {
  const itens = montarItensPedido(pedido)
  const totalValor = itens.reduce((s, i) => s + i.total, 0)
  const pago = PAID_STATUSES.has(pedido.status)

  return {
    numero,
    data:     fullDate(pedido.dataContato),
    situacao: 'Venda',
    vendedor: vendedorNome || '—',
    empresa:  montarEmpresa(empresa),
    cliente:  montarCliente(pedido.cliente, cliente),
    itens,
    totalItens: itens.length,
    totalValor,
    financeiro: [{
      numParcela:     '1/1',
      valor:          totalValor,
      dataPgto:       fullDate(pedido.dataContato),
      formaPagamento: (pedido.formasPagamento || []).map(f => PAG_TEXTO[f] || f).join(' + ') || '—',
      situacao:       pago ? 'Já pago' : 'Pendente',
    }],
    observacoes: pedido.observacoes || '',
  }
}

function dataDaVenda(venda) {
  const d = venda.criadoEm?.toDate ? venda.criadoEm.toDate() : null
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Monta o recibo de uma Venda avulsa (lançada direto no menu Vendas, sem vir de
// pedido) — um único item. "compra" é a Compra vinculada ao mesmo produtoId (se
// achada), de onde vêm os dados do aparelho (specs/serial/IMEI) pro campo de
// observações — mesmo texto cadastrado em "Editar Compra".
export function montarDadosReciboVendaAvulsa(venda, { numero, empresa, cliente, vendedorNome, compra }) {
  const valor = venda.valorVenda || 0
  const data = dataDaVenda(venda)

  return {
    numero,
    data,
    situacao: 'Venda',
    vendedor: vendedorNome || '—',
    empresa:  montarEmpresa(empresa),
    cliente:  montarCliente(venda.cliente, cliente),
    itens: [{ descricao: venda.produto || '—', precoUnit: valor, quant: 1, desconto: 0, total: valor }],
    totalItens: 1,
    totalValor: valor,
    financeiro: [{
      numParcela:     '1/1',
      valor,
      dataPgto:       data,
      formaPagamento: PAG_TEXTO[venda.formaPagamento] || venda.formaPagamento || '—',
      situacao:       'Já pago', // só existe botão de recibo quando a venda já está entregue
    }],
    observacoes: compra?.observacoes || '',
  }
}

export function renderReciboPreview(container, dados) {
  const linha = txt => el('div', {}, txt)

  const header = el('div', { class: 'recibo-header' },
    el('div', { class: 'recibo-empresa' },
      el('strong', {}, dados.empresa.fantasia || dados.empresa.razao),
      ...dados.empresa.enderecoLinhas.map(linha),
      dados.empresa.tel1 ? linha(`${dados.empresa.tel1} (whatsapp)`) : null,
      dados.empresa.tel2 ? linha(dados.empresa.tel2) : null,
      dados.empresa.cnpj ? linha(`CNPJ: ${dados.empresa.cnpj}`) : null,
    ),
    el('div', { class: 'recibo-numero' }, `Venda número ${dados.numero}`)
  )

  const dadosVenda = el('div', { class: 'recibo-section' },
    el('p', { class: 'recibo-section-title' }, 'DADOS DA VENDA'),
    el('div', { class: 'recibo-dados-grid' },
      el('div', {},
        linha(`Cliente: ${dados.cliente.nome}`),
        dados.cliente.telefone ? linha(`Telefone: ${dados.cliente.telefone}`) : null,
        dados.cliente.email ? linha(`E-mail: ${dados.cliente.email}`) : null,
        ...dados.cliente.enderecoLinhas.map((l, i) => linha(i === 0 ? `Endereço: ${l}` : l)),
      ),
      el('div', {},
        linha(`Data: ${dados.data}`),
        linha(`Situação: ${dados.situacao}`),
        linha(`Vendedor: ${dados.vendedor}`),
      ),
    )
  )

  const tabelaItens = el('table', { class: 'recibo-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'), el('th', {}, 'Descrição'), el('th', {}, 'Preço unit.'),
      el('th', {}, 'Quant.'), el('th', {}, 'Desconto'), el('th', {}, 'Total'),
    )),
    el('tbody', {}, ...dados.itens.map((it, i) => el('tr', {},
      el('td', {}, String(i + 1)), el('td', {}, it.descricao), el('td', {}, brl(it.precoUnit)),
      el('td', {}, String(it.quant)), el('td', {}, brl(it.desconto)), el('td', {}, brl(it.total)),
    ))),
    el('tfoot', {}, el('tr', {},
      el('td', { colspan: '3' }, ''), el('td', {}, 'TOTAL'), el('td', {}, String(dados.totalItens)), el('td', {}, brl(dados.totalValor)),
    ))
  )

  const tabelaFinanceiro = el('table', { class: 'recibo-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'), el('th', {}, 'Valor'), el('th', {}, 'Data pgto'),
      el('th', {}, 'Forma de pagamento'), el('th', {}, 'Situação'),
    )),
    el('tbody', {}, ...dados.financeiro.map(f => el('tr', {},
      el('td', {}, f.numParcela), el('td', {}, brl(f.valor)), el('td', {}, f.dataPgto),
      el('td', {}, f.formaPagamento), el('td', {}, f.situacao),
    ))),
  )

  const secoes = [
    header,
    dadosVenda,
    el('div', { class: 'recibo-section' }, el('p', { class: 'recibo-section-title' }, 'ITENS DA VENDA'), tabelaItens),
    el('div', { class: 'recibo-section' }, el('p', { class: 'recibo-section-title' }, 'FINANCEIRO'), tabelaFinanceiro,
      el('div', { class: 'recibo-total-geral' }, brl(dados.totalValor))),
  ]
  if (dados.observacoes) {
    secoes.push(el('div', { class: 'recibo-obs' },
      el('p', { class: 'recibo-section-title' }, 'Observações gerais'),
      el('p', { style: 'white-space:pre-line' }, dados.observacoes)
    ))
  }

  mount(container, el('div', { class: 'recibo-doc' }, ...secoes))
}
