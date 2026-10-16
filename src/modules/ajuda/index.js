import { el, mount } from '../../shared/utils/dom.js'
import { GROUPS } from './topics.js'

// Texto com <strong> vira nós DOM (nunca innerHTML).
function parseStrong(text) {
  const frag = document.createDocumentFragment()
  const parts = text.split(/(<strong>.*?<\/strong>)/g)
  for (const part of parts) {
    if (part.startsWith('<strong>')) {
      const s = document.createElement('strong')
      s.textContent = part.slice(8, -9)
      frag.appendChild(s)
    } else {
      frag.appendChild(document.createTextNode(part))
    }
  }
  return frag
}

function semTags(text) {
  return (text || '').replace(/<\/?strong>/g, '')
}

function normalizar(s) {
  return semTags(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const TODOS = GROUPS.flatMap(g => g.topics)

// Texto pesquisável de um tópico (título, intro, passos, dicas, avisos).
function indiceBusca(t) {
  const partes = [t.label, t.intro]
  t.sections.forEach(s => partes.push(s.titulo, s.texto, ...(s.passos || []), ...(s.fluxo || [])))
  partes.push(...(t.tips || []), ...(t.avisos || []))
  return normalizar(partes.filter(Boolean).join(' '))
}
const INDICES = new Map(TODOS.map(t => [t.id, indiceBusca(t)]))

function fluxoEl(etapas) {
  const wrap = el('div', { class: 'ajuda-fluxo' })
  etapas.forEach((e, i) => {
    if (i) wrap.appendChild(el('span', { class: 'ajuda-fluxo-seta' }, '→'))
    wrap.appendChild(el('span', { class: 'ajuda-fluxo-chip' }, e))
  })
  return wrap
}

function secaoEl(s) {
  const filhos = [el('h3', { class: 'ajuda-secao-titulo' }, s.titulo)]
  if (s.texto) {
    const p = el('p', { class: 'ajuda-texto' })
    p.appendChild(parseStrong(s.texto))
    filhos.push(p)
  }
  if (s.fluxo) filhos.push(fluxoEl(s.fluxo))
  if (s.passos?.length) {
    const ol = el('ol', { class: 'ajuda-steps' })
    for (const passo of s.passos) {
      const li = document.createElement('li')
      li.appendChild(parseStrong(passo))
      ol.appendChild(li)
    }
    filhos.push(ol)
  }
  return el('div', { class: 'ajuda-secao' }, ...filhos)
}

function caixaEl(boxClass, titleClass, itemClass, titulo, itens) {
  const box = el('div', { class: boxClass }, el('div', { class: titleClass }, titulo))
  for (const t of itens) {
    const d = el('div', { class: itemClass })
    d.appendChild(parseStrong(t))
    box.appendChild(d)
  }
  return box
}

export function render(container) {
  // Atalho do painel "?" (HelpPanel) pode pedir um tópico específico.
  let pedido = null
  try {
    pedido = sessionStorage.getItem('eixo:ajudaTopico')
    sessionStorage.removeItem('eixo:ajudaTopico')
  } catch { /* sem sessionStorage: abre no primeiro tópico */ }

  let activeTopic = TODOS.some(t => t.id === pedido) ? pedido : TODOS[0].id
  let busca = ''

  const contentArea = el('div', { class: 'ajuda-content' })
  const navWrap = el('div', { class: 'ajuda-nav-wrap' })

  const searchInp = el('input', { type: 'search', class: 'search-input ajuda-search', placeholder: 'Buscar no tutorial...' })
  searchInp.addEventListener('input', () => { busca = normalizar(searchInp.value.trim()); renderNav() })

  function renderTopic(id) {
    const topic = TODOS.find(t => t.id === id)
    if (!topic) return
    activeTopic = id
    renderNav()

    const intro = el('p', { class: 'ajuda-topic-intro' })
    intro.appendChild(parseStrong(topic.intro))

    mount(contentArea,
      el('div', { class: 'ajuda-topic-header' },
        el('span', { class: 'ajuda-topic-ico' }, topic.icon),
        el('div', {},
          el('h2', { class: 'ajuda-topic-title' }, topic.label),
          intro,
        ),
      ),
      ...topic.sections.map(secaoEl),
      ...(topic.avisos?.length ? [caixaEl('ajuda-aviso', 'ajuda-aviso-title', 'ajuda-aviso-item', '⚠️ Atenção', topic.avisos)] : []),
      ...(topic.tips?.length ? [caixaEl('ajuda-tips', 'ajuda-tips-title', 'ajuda-tip', '💡 Dicas', topic.tips)] : []),
    )
    contentArea.scrollIntoView?.({ block: 'nearest' })
  }

  function renderNav() {
    const blocos = []
    let total = 0
    for (const g of GROUPS) {
      const topics = g.topics.filter(t => !busca || INDICES.get(t.id).includes(busca))
      if (!topics.length) continue
      total += topics.length
      blocos.push(el('div', { class: 'ajuda-nav-group' }, g.label))
      const ul = el('ul', { class: 'ajuda-nav' })
      topics.forEach(t => {
        const li = el('li', { class: `ajuda-nav-item${t.id === activeTopic ? ' active' : ''}` },
          el('span', {}, t.icon),
          el('span', {}, t.label),
        )
        li.addEventListener('click', () => renderTopic(t.id))
        ul.appendChild(li)
      })
      blocos.push(ul)
    }
    if (!total) blocos.push(el('p', { class: 'ajuda-sem-resultado' }, 'Nada encontrado para essa busca.'))
    mount(navWrap, ...blocos)
  }

  mount(container,
    el('div', { class: 'ajuda-wrap' },
      el('div', { class: 'ajuda-sidebar' },
        el('div', { class: 'ajuda-sidebar-title' }, '📖 Tutorial'),
        el('div', { class: 'ajuda-search-wrap' }, searchInp),
        navWrap,
      ),
      contentArea,
    )
  )

  renderTopic(activeTopic)
}
