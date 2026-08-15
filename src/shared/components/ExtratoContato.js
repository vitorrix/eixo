import { el, mount } from '../utils/dom.js'
import { brl, shortDate } from '../utils/formatters.js'
import { montarEmpresa } from './Recibo.js'

// Extrato de lançamentos de uma categoria ou contato num período — mesmo
// documento visual do Recibo (.recibo-doc, já isolado pro @media print),
// só que listando N lançamentos em vez dos itens de uma venda.
export function montarDadosExtrato({ empresa, titulo, tipoLabel, periodoLabel, itens }) {
  const linhas = [...itens]
    .sort((a, b) => (a.dataLiquidacao || '').localeCompare(b.dataLiquidacao || ''))
    .map(it => ({ data: it.dataLiquidacao, descricao: it.descricao || '—', contato: it.contato || '', valor: Number(it.valor) || 0 }))
  return {
    empresa: montarEmpresa(empresa),
    titulo,
    tipoLabel,
    periodoLabel,
    itens: linhas,
    total: linhas.reduce((s, it) => s + it.valor, 0),
  }
}

export function renderExtratoPreview(container, dados) {
  const logoSrc = `${import.meta.env.BASE_URL}logo-baruk.png`
  const markSrc = `${import.meta.env.BASE_URL}apple-touch-icon.png`
  const mostraColunaContato = dados.itens.some(it => it.contato)

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
      el('div', { class: 'recibo-numero-label' }, 'Extrato'),
      el('div', { class: 'recibo-numero-valor' }, dados.tipoLabel),
    )
  )

  const infoSection = el('div', { class: 'recibo-section recibo-grid-2' },
    el('div', {},
      el('p', { class: 'recibo-eyebrow' }, mostraColunaContato ? 'Categoria' : 'Contato'),
      el('div', { class: 'recibo-line' }, dados.titulo),
    ),
    el('div', {},
      el('p', { class: 'recibo-eyebrow' }, 'Período'),
      el('div', { class: 'recibo-line' }, dados.periodoLabel),
    ),
  )

  const tabela = el('table', { class: 'recibo-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Data'), el('th', {}, 'Descrição'),
      mostraColunaContato ? el('th', {}, 'Contato') : null,
      el('th', {}, 'Valor'),
    )),
    el('tbody', {}, ...dados.itens.map(it => el('tr', {},
      el('td', {}, shortDate(it.data)), el('td', {}, it.descricao),
      mostraColunaContato ? el('td', {}, it.contato || '—') : null,
      el('td', {}, brl(it.valor)),
    ))),
    el('tfoot', {}, el('tr', {},
      el('td', { colspan: mostraColunaContato ? '3' : '2' }, `Total (${dados.itens.length} lançamento${dados.itens.length === 1 ? '' : 's'})`),
      el('td', {}, brl(dados.total)),
    )),
  )

  const footer = el('div', { class: 'recibo-footer' },
    el('img', { src: markSrc, alt: '', class: 'recibo-footer-mark' }),
    el('span', {},
      'Emitido pelo ', el('strong', {}, 'Eixo'), ' — uma plataforma ', el('strong', {}, 'Baruk Technology & Consulting'), '.'
    ),
  )

  mount(container, el('div', { class: 'recibo-doc' },
    masthead,
    el('div', { class: 'recibo-body' },
      infoSection,
      el('div', { class: 'recibo-section' },
        el('p', { class: 'recibo-eyebrow' }, 'Lançamentos'),
        tabela,
      ),
    ),
    footer,
  ))
}
