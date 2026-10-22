import dicionario from '../../../dicionario-cores.json' with { type: 'json' }
import aliases from '../../../dicionario-aliases.json' with { type: 'json' }

// Dicionário de cores por modelo (dicionario-cores.json, na raiz). Regras:
// - comparação em minúsculas, sem acento, hífen vira espaço, sem emoji/pontuação;
// - o texto da cor só é procurado entre as cores DAQUELE modelo;
// - se não achar (ou o apelido for ambíguo), devolve null — nunca adivinha;
// - modelo cuja única cor é "Sem cor" ignora o texto da cor.
// Usado pelo bot (leitura das listas) e pelo Eixo (filtro de cor da Busca).

// Normalização de texto de cor/apelido.
export function normalizarTexto(s) {
  return (s ?? '').toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Nome de modelo: igual, mas preserva polegadas ("13\"" e variações de aspas)
// e a barra de "Pro/Max" como espaço — só pra casar com a chave do dicionário.
export function normalizarModelo(s) {
  return (s ?? '').toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[”“″‶'’‘]/g, '"')
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-z0-9" ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MODELOS = new Map()   // modelo normalizado -> { nome, cores: [{ nome, apelidos:Set }], semCor }
for (const [nome, def] of Object.entries(dicionario.modelos)) {
  const cores = Object.entries(def.cores || {}).map(([corNome, c]) => ({
    nome: corNome,
    apelidos: new Set([corNome, ...(c.apelidos || [])].map(normalizarTexto).filter(Boolean)),
  }))
  // Apelidos extras decididos depois (dicionario-aliases.json): por modelo, ou
  // por "todo modelo que tem a cor X".
  for (const ex of aliases.cores || []) {
    const vale = ex.modelos ? ex.modelos.map(normalizarModelo).includes(normalizarModelo(nome)) : true
    if (!vale) continue
    const alvo = cores.find(c => normalizarTexto(c.nome) === normalizarTexto(ex.cor))
    if (alvo) ex.apelidos.forEach(a => alvo.apelidos.add(normalizarTexto(a)))
  }
  MODELOS.set(normalizarModelo(nome), {
    nome, cores,
    semCor: cores.length === 1 && normalizarTexto(cores[0].nome) === 'sem cor',
  })
}

export const NOMES_MODELOS = [...MODELOS.values()].map(m => m.nome)

// ── Nome do modelo: o fornecedor escreve do jeito dele ───────────────────────
// "Watch S11 GPS", "iPad Air 11 Inch M4 Wi-Fi", "iPhone 16 Pro 128G CPO"...
// Regras (não adivinham): tiram só ruído que não muda a cor (CPO, eSim, Wi-Fi,
// GPS, celular, capacidade, RAM, CPU/GPU, tamanho de caixa do Watch) e
// reescrevem abreviações conhecidas pro nome do dicionário. Se o resultado
// não existir no dicionário -> null (modelo/versão que ainda não foi decidido).
const ALIASES_MODELO = new Map(Object.entries(aliases.modelos || {}).map(([k, v]) => [normalizarModelo(k), v]))

function limparModelo(raw) {
  let t = (raw ?? '').toString()
    .replace(/(\d{2})[.,]\d(?=\s*(?:["”″]|inch|pol|\b))/gi, '$1')   // 13.6" -> 13", 14.2" -> 14"
  t = normalizarModelo(t)
  t = t.replace(/\b(\d+)\s?(inch|polegadas?|pol)\b/g, '$1"')
  t = t.replace(/\b(cpo|esim|e sim|asis|wifi|wi fi|wireless|cellular|celular|cell|cel|gps|5g|lte|regular|ssd|pack)\b/g, ' ')
  t = t.replace(/\b\d+\s?(gb|g|tb|t)\b/g, ' ')                       // 256g, 1t, 16g
  t = t.replace(/\b\d+\s?ram\b/g, ' ').replace(/\b\d{1,2}\s?c\s?(cpu|gpu)\b/g, ' ')
  t = t.replace(/\bpromax\b/g, 'pro max').replace(/\bpm\b/g, 'pro max')
  t = t.replace(/\bm(\d)(pro|max)\b/g, 'm$1 $2')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

function canonicoDoModelo(raw) {
  let t = limparModelo(raw)
  if (!t) return null
  // iPhone: "iphone 17 e" -> 17e; "17 air" -> iphone air; capacidade solta no fim
  if (t.startsWith('iphone')) {
    t = t.replace(/^iphone (\d{2}) e\b/, 'iphone $1e')
    t = t.replace(/^iphone 17 air\b/, 'iphone air')
    t = t.replace(/ (64|128|256|512|1024)$/, '')
    return t
  }
  // Apple Watch
  if (/^(apple )?watch\b/.test(t)) {
    t = t.replace(/^apple /, '').replace(/\bserie?s?\b/g, 'series').replace(/\bs(\d{1,2})\b/, 'series $1')
    t = t.replace(/\b(\d)\s?(ª|a|rd|nd|th)?\s*(geracao|generation|gen)\b/g, '$1')
    t = t.replace(/\b(38|40|41|42|44|45|46|49)\s?m?\b/g, ' ').replace(/\b(m l|s m|ml|sm)\b/g, ' ').replace(/\b\d{2}m\b/g, ' ')
    t = t.replace(/\s+/g, ' ').trim()
    const se = t.match(/^watch se(?![a-z])\s*(\d)?/)
    if (se) return se[1] === '3' || /\b3\b/.test(t) ? 'apple watch se 3' : null
    const ul = t.match(/^watch ultra\s*(\d)?/)
    if (ul) return ul[1] ? `apple watch ultra ${ul[1]}` : null
    const sr = t.match(/^watch series (\d{1,2})\b/)
    return sr ? `apple watch series ${sr[1]}` : null
  }
  // iPad
  if (t.startsWith('ipad')) {
    const sem = t.replace(/"/g, ' ')
    const familia = (sem.match(/\b(air|pro|mini)\b/) || [])[1]
    const chip = (sem.match(/\b(m\d|a1\d(?: pro)?)\b/) || [])[1]
    const tam = (sem.match(/\b(11|13)\b/) || [])[1]
    if (!familia) return (/^ipad (11|a16)/.test(sem) || chip === 'a16') ? 'ipad a16' : null
    if (familia === 'mini') return /\b(7|a17)\b/.test(sem) ? 'ipad mini a17 pro' : null
    return chip && tam ? `ipad ${familia} ${chip} ${tam}"` : null
  }
  // Mac
  if (/^(mac|imac)\b/.test(t) || t.startsWith('macbook')) {
    t = t.replace(/^mac (air|neo)\b/, 'macbook $1').replace(/^macbook (m\d) air\b/, 'macbook air $1')
    if (/^macbook m\d (pro|max)\b/.test(t)) return null   // "MacBook M5 Pro 14" = chip Pro ou modelo Pro? não adivinha
    if (/^macbook neo\b/.test(t)) return 'macbook neo 13"'
    if (/^mac ?mini\b/.test(t)) return 'mac mini'
    if (/^mac studio\b/.test(t)) return 'mac studio'
    if (/^imac\b/.test(t)) return 'imac m4 24"'
    const chip = (t.match(/\bm(\d)\b/) || [])[1]
    const sem = t.replace(/"/g, ' ')
    const tam = (sem.match(/\b(13|14|15|16)\b/) || [])[1]
    if (/^macbook air\b/.test(t)) return chip && (tam === '13' || tam === '15') ? `macbook air m${chip} ${tam}"` : null
    if (/^macbook pro\b/.test(t) && chip) {
      const proMax = /\b(pro|max)\b/.test(t.replace(/^macbook pro/, ''))
      if (chip === '5') return proMax && (tam === '14' || tam === '16') ? `macbook pro m5 pro/max ${tam}"` : (tam === '14' ? 'macbook pro m5 14"' : null)
      if (chip === '4') {
        if (tam === '14') return proMax ? null : 'macbook pro m4 14"'   // M4 Pro/Max 14" é outro modelo (não está no dicionário)
        return tam === '16' && proMax ? 'macbook pro m4 pro/max 16"' : null
      }
    }
    return null
  }
  // Acessórios
  if (/^airtag\b/.test(t)) return 'airtag'
  if (/^(apple )?pencil\b/.test(t)) {
    const resto = t.replace(/^(apple )?pencil\s*/, '')
    return resto === 'usb c' ? 'apple pencil usb c' : resto === 'pro' ? 'apple pencil pro' : null
  }
  return t
}

// Modelo oficial (objeto do dicionário) a partir do nome como veio da lista.
export function buscarModelo(modelo) {
  const direto = MODELOS.get(normalizarModelo(modelo))
  if (direto) return direto
  const alias = ALIASES_MODELO.get(normalizarModelo(modelo))
  if (alias && MODELOS.get(normalizarModelo(alias))) return MODELOS.get(normalizarModelo(alias))
  const canon = canonicoDoModelo(modelo)
  if (!canon) return null
  return MODELOS.get(normalizarModelo(canon)) || null
}

export function modeloExiste(modelo) {
  return !!buscarModelo(modelo)
}

// Cores oficiais do modelo (pro filtro da Busca) — [] se o modelo não existe
// ou não tem cor.
export function coresOficiais(modelo) {
  const m = buscarModelo(modelo)
  return m && !m.semCor ? m.cores.map(c => c.nome) : []
}

// Retorna o nome oficial da cor (ex: "Branco"), '' quando o modelo é "sem
// cor" (a cor da lista é ignorada) ou null quando não reconhece — modelo fora
// do dicionário, texto vazio ou apelido que não pertence ao modelo.
export function normalizarCor(modelo, textoCor) {
  const m = buscarModelo(modelo)
  if (!m) return null
  if (m.semCor) return ''
  const t = normalizarTexto(textoCor)
  if (!t) return null
  const achadas = m.cores.filter(c => c.apelidos.has(t))
  return achadas.length === 1 ? achadas[0].nome : null
}

// Procura a cor dentro de uma linha inteira da lista (ex: "iPhone 17 Pro Max
// 256GB Silver 8500") — só entre os apelidos do modelo, por palavra inteira,
// preferindo o apelido mais longo. Ambíguo/sem achado -> null. Usado só pra
// auditoria (relatório): o fluxo normal recebe o texto da cor já separado.
export function corNoTexto(modelo, linha) {
  const m = buscarModelo(modelo)
  if (!m || m.semCor) return null
  const alvo = ` ${normalizarTexto(linha)} `
  let melhor = null, empate = false
  for (const c of m.cores) {
    for (const ap of c.apelidos) {
      if (!alvo.includes(` ${ap} `)) continue
      if (!melhor || ap.length > melhor.ap.length) { melhor = { ap, cor: c.nome }; empate = false }
      else if (ap.length === melhor.ap.length && c.nome !== melhor.cor) empate = true
    }
  }
  return melhor && !empate ? melhor.cor : null
}

// Decisão de cor de UMA oferta, usada pelo bot (listas novas) e pelo
// reprocessamento das ofertas já gravadas — mesma regra nos dois.
//   estado 'modelo-fora'    -> modelo não está no dicionário: quem chama mantém o
//                              comportamento antigo (colorMap.js), cor não definida aqui
//   estado 'sem-cor-modelo' -> modelo "Sem cor": cor ''
//   estado 'oficial'        -> cor oficial do dicionário
//   estado 'sem-texto'      -> modelo com cores, mas a lista não informou cor: ''
//   estado 'revisar'        -> não reconhece o texto: cor '' + vai pra fila de revisão
export function aplicarCor(modelo, textoCor) {
  const m = buscarModelo(modelo)
  if (!m) return { estado: 'modelo-fora', modeloOficial: '', cor: undefined }
  if (m.semCor) return { estado: 'sem-cor-modelo', modeloOficial: m.nome, cor: '' }
  const texto = (textoCor ?? '').toString().trim()
  if (!texto) return { estado: 'sem-texto', modeloOficial: m.nome, cor: '' }
  const oficial = normalizarCor(modelo, texto)
  if (oficial) return { estado: 'oficial', modeloOficial: m.nome, cor: oficial }
  return { estado: 'revisar', modeloOficial: m.nome, cor: '' }
}

// Apelido decidido na tela de revisão (guardado em configuracoes/coresExtras e
// recarregado pelo bot a cada partida) — vale pro modelo oficial e a cor oficial.
export function adicionarApelidoCor(modeloOficial, corOficial, texto) {
  const m = buscarModelo(modeloOficial)
  const c = m?.cores.find(x => normalizarTexto(x.nome) === normalizarTexto(corOficial))
  const t = normalizarTexto(texto)
  if (!c || !t) return false
  c.apelidos.add(t)
  return true
}
