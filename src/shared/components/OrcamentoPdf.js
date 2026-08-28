import { el, mount } from '../utils/dom.js'
import { brl } from '../utils/formatters.js'

// Documento formal de orçamento — alguns clientes pedem em PDF pra apresentar
// numa empresa (reembolso, aprovação de compra etc.), então precisa do CNPJ/CPF
// do lado do cliente e um visual sério, diferente da mensagem casual do
// WhatsApp. Reaproveita o mesmo esqueleto visual do Recibo (masthead da
// empresa, seções, tabela, rodapé) — dados.empresa já vem pronto de
// montarEmpresa() (Recibo.js).
export function montarDadosOrcamentoPdf({
  empresa, data, tipo, clienteNome, clienteDocLabel, clienteDoc,
  itens = [], usados = [], novos = [], avarias = [],
  desconto = 0, liquido = 0, entrada = 0, restante = 0,
  diferenca = 0, troco = 0, opcoesParcelamento = [],
  frete = 0, seguro = 0,
}) {
  return {
    empresa, data, tipo, clienteNome, clienteDocLabel, clienteDoc,
    itens, usados, novos, avarias,
    desconto, liquido, entrada, restante,
    diferenca, troco, opcoesParcelamento,
    frete, seguro,
  }
}

function itensTable(itens) {
  return el('table', { class: 'recibo-table' },
    el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Descrição'), el('th', {}, 'Valor'))),
    el('tbody', {}, ...itens.map((it, i) => el('tr', {},
      el('td', {}, String(i + 1)), el('td', {}, it.descricao), el('td', {}, brl(it.valor)),
    ))),
    el('tfoot', {}, el('tr', {},
      el('td', { colspan: '2' }, 'Total'),
      el('td', {}, brl(itens.reduce((s, i) => s + (i.valor || 0), 0))),
    )),
  )
}

// Todas as opções de parcelamento (1x-12x) em 2 colunas, em vez de só a
// selecionada na tela — quem recebe o PDF quer ver o leque todo — e em grid
// pra não esticar o documento verticalmente. Só faz sentido quando existe
// algo a cobrar do cliente; numa troca com troco a devolver não há o que
// parcelar.
function parcelamentoGrid(opcoes) {
  if (!opcoes.length) return null
  return el('div', { class: 'recibo-parc-grid' },
    ...opcoes.map(o => el('div', { class: 'recibo-parc-cell' }, o.n === 1
      ? `1x à vista — ${brl(o.valorTotal)}`
      : `${o.n}x de ${brl(o.valorParcela)} — total ${brl(o.valorTotal)}`)),
  )
}

export function renderOrcamentoPdfPreview(container, dados) {
  const linha = (txt, muted) => el('div', { class: muted ? 'recibo-line recibo-line-muted' : 'recibo-line' }, txt)

  const logoSrc = `${import.meta.env.BASE_URL}logo-baruk.png`
  const markSrc = `${import.meta.env.BASE_URL}apple-touch-icon.png`

  const masthead = el('div', { class: 'recibo-masthead' },
    el('div', { class: 'recibo-masthead-brand' },
      el('img', { src: logoSrc, alt: dados.empresa.fantasia || 'Baruk', class: 'recibo-logo' }),
      el('div', { class: 'recibo-masthead-info' },
        ...dados.empresa.enderecoLinhas.map(l => el('div', { class: 'recibo-empresa-linha' }, l)),
        dados.empresa.tel1 ? el('div', { class: 'recibo-empresa-linha' }, `${dados.empresa.tel1} (whatsapp)`) : null,
        dados.empresa.cnpj ? el('div', { class: 'recibo-empresa-linha' }, `CNPJ ${dados.empresa.cnpj}`) : null,
      ),
    ),
    el('div', { class: 'recibo-masthead-numero' },
      el('div', { class: 'recibo-numero-label' }, 'Orçamento'),
      el('div', { class: 'recibo-numero-valor' }, dados.data),
    )
  )

  const dadosCabecalho = el('div', { class: 'recibo-section recibo-grid-2' },
    el('div', {},
      el('p', { class: 'recibo-eyebrow' }, 'Para'),
      linha(dados.clienteNome || '—'),
      dados.clienteDoc ? linha(`${dados.clienteDocLabel}: ${dados.clienteDoc}`, true) : null,
    ),
    el('div', {},
      el('p', { class: 'recibo-eyebrow' }, 'Detalhes'),
      linha(`Data: ${dados.data}`),
      linha('Validade: 48 horas', true),
    ),
  )

  const secoes = [dadosCabecalho]

  if (dados.tipo === 'troca') {
    secoes.push(el('div', { class: 'recibo-section' },
      el('p', { class: 'recibo-eyebrow' }, 'Aparelho(s) do cliente na troca'),
      itensTable(dados.usados),
    ))
    if (dados.avarias.length) {
      secoes.push(el('div', { class: 'recibo-obs' },
        el('p', { class: 'recibo-eyebrow' }, 'Análise técnica'),
        ...dados.avarias.map(a => linha(`${a.nome}: − ${brl(a.val)}`)),
      ))
    }
    secoes.push(el('div', { class: 'recibo-section' },
      el('p', { class: 'recibo-eyebrow' }, 'Aparelho(s) desejado(s)'),
      itensTable(dados.novos),
    ))
  } else {
    secoes.push(el('div', { class: 'recibo-section' },
      el('p', { class: 'recibo-eyebrow' }, 'Itens'),
      itensTable(dados.itens),
    ))
  }

  const resumoLinhas = []
  if (dados.desconto > 0) resumoLinhas.push(linha(`Desconto: − ${brl(dados.desconto)}`))
  if (dados.frete > 0)  resumoLinhas.push(linha(`Frete: ${brl(dados.frete)}`))
  if (dados.seguro > 0) resumoLinhas.push(linha(`Seguro: ${brl(dados.seguro)}`))
  if (dados.tipo === 'troca' && dados.troco > 0) {
    resumoLinhas.push(linha(`Troco a devolver ao cliente: ${brl(dados.troco)}`))
  } else {
    const valorFinal = dados.tipo === 'troca' ? dados.diferenca : dados.liquido
    resumoLinhas.push(linha(`${dados.tipo === 'troca' ? 'Diferença a pagar' : 'Total líquido'}: ${brl(valorFinal)}`))
    if (dados.entrada > 0) {
      resumoLinhas.push(linha(`Entrada: ${brl(dados.entrada)}`))
      resumoLinhas.push(linha(`Restante: ${brl(dados.restante)}`))
    }
  }
  secoes.push(el('div', { class: 'recibo-section' },
    el('p', { class: 'recibo-eyebrow' }, 'Resumo financeiro'),
    ...resumoLinhas,
  ))

  const grid = (dados.troco > 0) ? null : parcelamentoGrid(dados.opcoesParcelamento)
  if (grid) {
    secoes.push(el('div', { class: 'recibo-section' },
      el('p', { class: 'recibo-eyebrow' }, 'Opções de parcelamento (cartão)'),
      grid,
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
