import { normalizarTexto } from './dicionarioCores.js'

// Condição do aparelho nas listas dos fornecedores: Lacrado, CPO (recondicionado
// pela Apple — também conta como lacrado no filtro da Busca) e Semi-novo.
// A condição quase nunca vem na linha do aparelho: vem em CABEÇALHOS de seção
// ("——— 📱LACRADOS📱 ———", "📱IPHONES SEMINOVO📱") que valem para as linhas
// seguintes. Ordem de decisão: linha > cabeçalho da seção > padrão do cadastro
// do fornecedor. Sem nenhum dos três -> null (não adivinha; vai pra revisão).

export const CONDICOES = { lacrado: 'Lacrado', cpo: 'CPO', seminovo: 'Semi-novo' }

const RE_CPO = /\b(cpo|certified pre owned|recondicionad[oa]s? pela apple|recondicionad[oa]s? apple)\b/
// vitrine, swap, open box e ASIS contam como semi-novo (aparelho já aberto/usado)
const RE_SEMI = /\b(semi ?novos?|seminovos?|usad[oa]s?|used|vitrine|swap|open ?box|caixa aberta|asis|as is)\b/
const RE_LACRADO = /\b(lacrad[oa]s?|sealed|novos?|new)\b/

// Condição dita num texto (uma linha ou cabeçalho). Termos conflitantes -> null.
export function condicaoDoTexto(texto) {
  const t = normalizarTexto(texto)
  if (!t) return null
  const cpo = RE_CPO.test(t), semi = RE_SEMI.test(t)
  const lacrado = RE_LACRADO.test(t.replace(/semi ?novos?/g, ' '))   // "semi novo" não é "novo"
  if (semi && (lacrado || cpo)) return null
  if (cpo) return 'cpo'
  if (semi) return 'seminovo'
  if (lacrado) return 'lacrado'
  return null
}

// Linha com cara de preço (R$/$ ou número de milhar), ignorando datas.
const RE_PRECO = /(r\$|\$)|\d{1,3}[.,]\d{3}\b|\b\d{4,5}\b/
function temPreco(linha) {
  return RE_PRECO.test(linha.replace(/\d{1,2}\s*[\/.-]\s*\d{1,2}\s*[\/.-]\s*\d{2,4}/g, ' '))
}

// Cabeçalho de seção: linha curta, sem preço, que cita uma condição.
export function condicaoDeCabecalho(linha) {
  const l = (linha || '').trim()
  if (!l || l.length > 90 || temPreco(l)) return null
  return condicaoDoTexto(l)
}

// Condição da linha idx de uma lista (array de linhas).
// -> { condicao: 'lacrado'|'cpo'|'seminovo'|null, origem: 'linha'|'secao'|null }
export function condicaoDaLinha(linhas, idx) {
  const propria = condicaoDoTexto(linhas[idx])
  if (propria) return { condicao: propria, origem: 'linha', texto: linhas[idx] }
  for (let i = idx - 1; i >= 0; i--) {
    const c = condicaoDeCabecalho(linhas[i])
    if (c) return { condicao: c, origem: 'secao', texto: linhas[i] }
  }
  return { condicao: null, origem: null }
}

// Padrão do cadastro do fornecedor (campo condicao: novo | seminovo | misto).
export function condicaoPadraoDoFornecedor(condicao) {
  if (condicao === 'novo') return 'lacrado'
  if (condicao === 'seminovo') return 'seminovo'
  return null   // misto/sem cadastro: sem padrão
}

// Filtro da Busca: "Lacrado" inclui CPO.
export function ehLacrado(condicao) {
  return condicao === 'lacrado' || condicao === 'cpo'
}

// ── Localizar a linha da oferta dentro da mensagem da lista ──────────────────
// Pelo preço (vários formatos: 4350, 4.350, 4,350, 4 350) + número do modelo e
// capacidade pra desempatar. -1 se não achar.
function formatosDoPreco(preco) {
  const p = Math.round(Number(preco))
  if (!p) return []
  const milhar = Math.floor(p / 1000), resto = String(p % 1000).padStart(3, '0')
  return [String(p), `${milhar}.${resto}`, `${milhar},${resto}`, `${milhar} ${resto}`]
}

export function localizarLinha(linhas, { produtoNome = '', capacidade = '', preco = 0 }) {
  const formatos = formatosDoPreco(preco)
  if (!formatos.length) return -1
  const temPrecoNaLinha = l => formatos.some(f => new RegExp(`(^|[^\\d])${f.replace('.', '\\.')}([^\\d]|$)`).test(l))
  let cand = linhas.map((l, i) => i).filter(i => temPrecoNaLinha(linhas[i]))
  if (cand.length > 1) {
    const tok = normalizarTexto(produtoNome).split(' ').find(t => /\d/.test(t))
    const f1 = cand.filter(i => tok && normalizarTexto(linhas[i]).split(' ').includes(tok))
    if (f1.length) cand = f1
  }
  if (cand.length > 1 && capacidade) {
    const cap = normalizarTexto(capacidade).replace(/ /g, '').replace(/gb|tb/, '')
    const f2 = cand.filter(i => normalizarTexto(linhas[i]).replace(/ /g, '').includes(cap))
    if (f2.length) cand = f2
  }
  return cand.length ? cand[0] : -1
}

// "iPhone 16 128GB CPO" -> { nome: "iPhone 16 128GB", cpo: true }
export function separarCpo(produto) {
  const t = (produto || '').toString()
  const cpo = /\bcpo\b/i.test(t)
  return { nome: cpo ? t.replace(/\bcpo\b/gi, ' ').replace(/\s+/g, ' ').trim() : t, cpo }
}

// Decisão da condição de UMA oferta. Ordem: CPO no nome > linha > cabeçalho da
// seção > sinal de seminovo já lido pela IA > padrão decidido pra esse fornecedor
// (tela de revisão) > padrão do cadastro (novo/seminovo). A lista vale mais que o
// cadastro. Nada disso -> null (vai pra revisão do fornecedor).
// -> { condicao, origem: 'modelo'|'linha'|'secao'|'ia'|'fornecedor'|'cadastro'|null }
export function decidirCondicao({ texto, produtoBruto, produtoNome, capacidade, preco, padraoAprendido, padraoCadastro, seminovoIA }) {
  if (/\bcpo\b/i.test(produtoBruto || '')) return { condicao: 'cpo', origem: 'modelo' }
  const linhas = (texto || '').split('\n')
  const idx = localizarLinha(linhas, { produtoNome: produtoNome || produtoBruto, capacidade, preco })
  if (idx >= 0) {
    const r = condicaoDaLinha(linhas, idx)
    if (r.condicao) return { condicao: r.condicao, origem: r.origem }
  }
  if (seminovoIA === true) return { condicao: 'seminovo', origem: 'ia' }
  if (padraoAprendido) return { condicao: padraoAprendido, origem: 'fornecedor' }
  const cad = condicaoPadraoDoFornecedor(padraoCadastro)
  if (cad) return { condicao: cad, origem: 'cadastro' }
  return { condicao: null, origem: null }
}
