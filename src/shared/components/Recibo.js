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

// Botão "Imprimir / PDF" — usa o diálogo nativo de impressão do navegador
// (a própria janela do sistema já oferece "Salvar como PDF" como impressora,
// então cobre as duas coisas sem precisar gerar o PDF de novo no cliente).
// O CSS @media print (global.css) isola só o .recibo-doc, formatado pra A4.
export function criarBotaoImprimir() {
  const btn = el('button', { type: 'button', class: 'btn btn-outline' }, '🖨️ Imprimir / PDF')
  btn.addEventListener('click', () => window.print())
  return btn
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

// Junta a observação livre do pedido com os "dados do aparelho" de cada Compra
// linkada (preenchidos na confirmação de pagamento ou depois, em Editar Compra)
// — mesmo texto que aparece no recibo da venda avulsa via montarDadosReciboVendaAvulsa.
function montarObservacoesPedido(pedido, comprasPedido) {
  const partes = pedido.observacoes ? [pedido.observacoes] : []
  const produtos = pedido.produtos || []
  const itensComAparelho = produtos
    .map(p => ({ label: produtoLabel(p), compra: (comprasPedido || []).find(c => c.produto === produtoLabel(p)) }))
    .filter(x => x.compra?.observacoes)

  if (itensComAparelho.length === 1 && produtos.length === 1) {
    partes.push(itensComAparelho[0].compra.observacoes)
  } else {
    itensComAparelho.forEach(({ label, compra }) => partes.push(`${label}:\n${compra.observacoes}`))
  }
  return partes.join('\n\n')
}

// Monta o objeto de dados do recibo de um Pedido — mesma estrutura usada no
// preview (HTML) e gravada na fila (recibosFila) pro bot montar o PDF de verdade.
// comprasPedido: Compras vinculadas a esse pedido (pedidoId) — usadas só pra
// puxar os "dados do aparelho" de cada item pro campo de observações.
export function montarDadosRecibo(pedido, { numero, empresa, cliente, vendedorNome, comprasPedido = [] }) {
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
    observacoes: montarObservacoesPedido(pedido, comprasPedido),
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

function situacaoCell(texto) {
  return texto === 'Já pago'
    ? el('span', { class: 'recibo-badge-pago' }, texto)
    : el('span', {}, texto)
}

export function renderReciboPreview(container, dados) {
  const linha = (txt, muted) => el('div', { class: muted ? 'recibo-line recibo-line-muted' : 'recibo-line' }, txt)
  const logoSrc = `${import.meta.env.BASE_URL}logo-baruk.png` // empresa que usa o Eixo — vai no cabeçalho
  const markSrc = `${import.meta.env.BASE_URL}apple-touch-icon.png` // selo do Eixo — só no rodapé

  const masthead = el('div', { class: 'recibo-masthead' },
    el('div', { class: 'recibo-masthead-brand' },
      el('img', { src: logoSrc, alt: dados.empresa.fantasia || 'Baruk', class: 'recibo-logo' }),
      el('div', { class: 'recibo-masthead-info' },
        ...dados.empresa.enderecoLinhas.map(l => el('div', { class: 'recibo-empresa-linha' }, l)),
        dados.empresa.tel1 ? el('div', { class: 'recibo-empresa-linha' }, `${dados.empresa.tel1} (whatsapp)`) : null,
        dados.empresa.tel2 ? el('div', { class: 'recibo-empresa-linha' }, dados.empresa.tel2) : null,
        dados.empresa.cnpj ? el('div', { class: 'recibo-empresa-linha' }, `CNPJ ${dados.empresa.cnpj}`) : null,
      ),
    ),
    el('div', { class: 'recibo-masthead-numero' },
      el('div', { class: 'recibo-numero-label' }, 'Recibo'),
      el('div', { class: 'recibo-numero-valor' }, `Nº ${dados.numero}`),
    )
  )

  const dadosVenda = el('div', { class: 'recibo-section recibo-grid-2' },
    el('div', {},
      el('p', { class: 'recibo-eyebrow' }, 'Faturado para'),
      linha(dados.cliente.nome),
      dados.cliente.telefone ? linha(dados.cliente.telefone, true) : null,
      dados.cliente.email ? linha(dados.cliente.email, true) : null,
      ...dados.cliente.enderecoLinhas.map(l => linha(l, true)),
    ),
    el('div', {},
      el('p', { class: 'recibo-eyebrow' }, 'Detalhes'),
      linha(`Data: ${dados.data}`),
    ),
  )

  const tabelaItens = el('table', { class: 'recibo-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'), el('th', {}, 'Descrição'), el('th', {}, 'Preço unit.'),
      el('th', {}, 'Qtd.'), el('th', {}, 'Desconto'), el('th', {}, 'Total'),
    )),
    el('tbody', {}, ...dados.itens.map((it, i) => el('tr', {},
      el('td', {}, String(i + 1)), el('td', {}, it.descricao), el('td', {}, brl(it.precoUnit)),
      el('td', {}, String(it.quant)), el('td', {}, brl(it.desconto)), el('td', {}, brl(it.total)),
    ))),
    el('tfoot', {}, el('tr', {},
      el('td', { colspan: '2' }, 'Total'),
      el('td', {}, ''),
      el('td', {}, String(dados.itens.reduce((s, i) => s + i.quant, 0))),
      el('td', {}, brl(dados.itens.reduce((s, i) => s + i.desconto, 0))),
      el('td', {}, brl(dados.totalValor)),
    )),
  )

  const tabelaFinanceiro = el('table', { class: 'recibo-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, '#'), el('th', {}, 'Valor'), el('th', {}, 'Data pgto'),
      el('th', {}, 'Forma de pagamento'), el('th', {}, 'Situação'),
    )),
    el('tbody', {}, ...dados.financeiro.map(f => el('tr', {},
      el('td', {}, f.numParcela), el('td', {}, brl(f.valor)), el('td', {}, f.dataPgto),
      el('td', {}, f.formaPagamento), el('td', {}, situacaoCell(f.situacao)),
    ))),
  )

  const secoes = [
    dadosVenda,
    el('div', { class: 'recibo-section' },
      el('p', { class: 'recibo-eyebrow' }, 'Itens'),
      tabelaItens,
    ),
    el('div', { class: 'recibo-section' },
      el('p', { class: 'recibo-eyebrow' }, 'Pagamento'),
      tabelaFinanceiro,
    ),
  ]
  if (dados.observacoes) {
    secoes.push(el('div', { class: 'recibo-obs' },
      el('p', { class: 'recibo-eyebrow' }, 'Observações'),
      el('p', { style: 'white-space:pre-line;margin:0' }, dados.observacoes)
    ))
  }

  const footer = el('div', { class: 'recibo-footer' },
    el('img', { src: markSrc, alt: '', class: 'recibo-footer-mark' }),
    el('span', {},
      'Emitido pelo ', el('strong', {}, 'Eixo'), ' — uma plataforma ', el('strong', {}, 'Baruk Technology & Consulting'), '.'
    ),
  )

  mount(container, el('div', { class: 'recibo-doc' }, masthead, el('div', { class: 'recibo-body' }, ...secoes), footer))
}
