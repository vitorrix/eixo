import { el, mount } from '../../shared/utils/dom.js'
import { brl, fullDate, maskCEP, maskPhone } from '../../shared/utils/formatters.js'
import { produtoLabel } from './service.js'

const PAG_TEXTO = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }
const PAID_STATUSES = new Set(['pago', 'motoboy', 'retirada', 'correio', 'entregue'])

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

// Cada produto do pedido vira um item; cada acessório vira um item "brinde" (preço
// e desconto não são rastreados por acessório hoje, então entra a R$ 0 — simplificação
// a refinar depois se quisermos casar o preço com o catálogo).
function montarItens(pedido) {
  const itens = []
  ;(pedido.produtos || []).forEach(p => {
    itens.push({ descricao: produtoLabel(p), precoUnit: p.valor || 0, quant: 1, desconto: 0, total: p.valor || 0 })
    ;(p.acessorios || []).forEach(nome => {
      itens.push({ descricao: nome, precoUnit: 0, quant: 1, desconto: 0, total: 0 })
    })
  })
  return itens
}

// Monta o objeto de dados do recibo — mesma estrutura usada no preview (HTML) e
// gravada na fila (recibosFila) pro bot montar o PDF de verdade.
export function montarDadosRecibo(pedido, { numero, empresa, cliente, vendedorNome }) {
  const itens = montarItens(pedido)
  const totalValor = itens.reduce((s, i) => s + i.total, 0)
  const pago = PAID_STATUSES.has(pedido.status)

  return {
    numero,
    data: fullDate(pedido.dataContato),
    situacao: 'Venda',
    vendedor: vendedorNome || '—',
    empresa: {
      razao:          empresa?.razao    || '',
      fantasia:       empresa?.fantasia || '',
      cnpj:           empresa?.cnpj     || '',
      tel1:           empresa?.tel1 ? maskPhone(empresa.tel1) : '',
      tel2:           empresa?.tel2 ? maskPhone(empresa.tel2) : '',
      email:          empresa?.email    || '',
      enderecoLinhas: linhasEndereco(empresa?.address, { comBairro: false }),
    },
    cliente: {
      nome:           pedido.cliente || '',
      telefone:       cliente?.phone ? maskPhone(cliente.phone) : '',
      email:          cliente?.email || '',
      enderecoLinhas: linhasEndereco(cliente?.address),
    },
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
