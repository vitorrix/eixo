import { buscarModelo, corNoTexto, normalizarCor, normalizarModelo, normalizarTexto } from './dicionarioCores.js'

// Lista de desejos x estoque. Estoque = Compras com status "estoque" (uma por
// aparelho); o nome vem digitado do jeito de cada fornecedor ("iPhone 15 Pro
// 512GB S/N · Azul"), então modelo, capacidade e cor são lidos do texto.
//   idêntico   -> mesmo modelo + mesma capacidade + mesma cor (o que o cliente
//                 não especificou vale como "qualquer")
//   semelhante -> mesmo modelo, mas capacidade ou cor diferente (ou cor que não
//                 deu pra confirmar no texto da compra)

const RE_CAP = /(\d+)\s?(gb|tb)\b/gi
const toGB = (n, u) => (u.toLowerCase() === 'tb' ? n * 1024 : n)

export const CAPACIDADES = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']

// Maior valor de GB/TB do texto — em Mac o SSD é sempre >= RAM.
export function capacidadeDoTexto(texto) {
  let maior = 0
  for (const m of (texto || '').matchAll(RE_CAP)) maior = Math.max(maior, toGB(Number(m[1]), m[2]))
  return maior || null
}

// Tira só o ruído que não muda o modelo (capacidade, S/N, CPO, eSIM, parênteses,
// "Mod.A1234") e devolve o nome oficial do dicionário; modelo fora do
// dicionário fica com o texto limpo e normalizado.
export function modeloCanonico(nome) {
  let t = (nome || '').split('·')[0]
  t = t.replace(/\([^)]*\)/g, ' ').replace(/mod\.?\s*a\d{4}/gi, ' ').replace(RE_CAP, ' ')
    .replace(/\b(s\/n|sn|cpo|esim|lacrado|novo|seminovo|semi novo)\b/gi, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  return buscarModelo(t)?.nome || normalizarModelo(t)
}

// Unidades em estoque (compras com status "estoque") já lidas. Compra com
// itens[] (nota com vários produtos) vira uma unidade por item.
export function unidadesDeEstoque(compras) {
  const out = []
  for (const c of compras) {
    if (c.status !== 'estoque') continue
    const itens = Array.isArray(c.itens) && c.itens.length ? c.itens : [{ produto: c.produto, quantidade: c.quantidade }]
    for (const it of itens) {
      const produto = it.produto || ''
      const modelo = modeloCanonico(produto)
      if (!modelo) continue
      const texto = `${produto} ${c.observacoes || ''}`
      out.push({
        compraId: c.id, produto, modelo,
        capacidade: capacidadeDoTexto(produto) || capacidadeDoTexto(c.observacoes),
        cor: corNoTexto(modelo, texto),
        fornecedor: c.fornecedor || '',
      })
    }
  }
  return out
}

// -> { identicos: unidade[], semelhantes: unidade[] }
export function compararDesejo(desejo, unidades) {
  const modelo = modeloCanonico(desejo.modelo)
  const cap = capacidadeDoTexto(desejo.capacidade)
  // cor digitada vira a cor oficial do modelo ("Titânio Preto" -> "Preto"); fora do dicionário, compara o texto
  const cor = normalizarTexto(normalizarCor(modelo, desejo.cor) || desejo.cor)
  const identicos = [], semelhantes = []
  for (const u of unidades) {
    if (u.modelo !== modelo) continue
    const capOk = !cap || u.capacidade === cap
    const corOk = !cor || (u.cor && normalizarTexto(u.cor) === cor)
    ;(capOk && corOk ? identicos : semelhantes).push(u)
  }
  return { identicos, semelhantes }
}

export function rotuloUnidade(u) {
  const cap = u.capacidade ? (u.capacidade >= 1024 ? `${u.capacidade / 1024}TB` : `${u.capacidade}GB`) : ''
  return [u.produto.split('·')[0].trim(), u.cor && !normalizarTexto(u.produto).includes(normalizarTexto(u.cor)) ? u.cor : ''].filter(Boolean).join(' · ') + (cap && !/\d\s?(gb|tb)/i.test(u.produto) ? ` ${cap}` : '')
}

export const rotuloDesejo = d => [d.modelo, d.capacidade, d.cor].filter(Boolean).join(' ')

// Mensagem pro cliente: idêntico -> "chegou"; só semelhante -> oferece como alternativa.
export function mensagemAviso(d, r) {
  const nome = (d.cliente || '').trim().split(/\s+/)[0]
  const abre = `Olá${nome ? ', ' + nome : ''}! Aqui é da Baruk Technology.`
  if (r.identicos.length) {
    return `${abre} Chegou o ${rotuloDesejo(d)} que você pediu pra avisar. Quer que eu separe pra você?`
  }
  const u = r.semelhantes[0]
  return `${abre} Você tinha pedido pra avisar do ${rotuloDesejo(d)}. Não chegou exatamente esse, mas tenho um ${rotuloUnidade(u)} disponível. Quer saber mais?`
}
