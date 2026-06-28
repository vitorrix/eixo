import { el, mount } from '../../shared/utils/dom.js'
import { db } from '../../firebase.js'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'

function R(v) {
  if (!v || isNaN(v)) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TX = [null,
  {v:3.17,p:0},    {v:2.75,p:1.70}, {v:2.75,p:2.55},
  {v:2.75,p:3.40}, {v:2.75,p:4.25}, {v:2.75,p:5.10},
  {v:2.59,p:5.95}, {v:2.59,p:6.80}, {v:2.59,p:7.65},
  {v:2.59,p:8.50}, {v:2.59,p:9.35}, {v:2.59,p:10.20},
]

function cobrar(liq, n) {
  const t = TX[n]
  return liq / (1 - (t.v + t.p) / 100)
}

// ── Product data ──────────────────────────────────────────────────
const NOVOS = [
  { group: 'iPhone 17', items: [
    { label: 'iPhone 17 256GB', price: 5590 },
    { label: 'iPhone 17 512GB', price: 0 },
    { label: 'iPhone 17 Air 256GB', price: 6190 },
    { label: 'iPhone 17 Air 512GB', price: 6790 },
    { label: 'iPhone 17 Pro 256GB', price: 7550 },
    { label: 'iPhone 17 Pro 512GB', price: 9090 },
    { label: 'iPhone 17 Pro 1TB', price: 10290 },
    { label: 'iPhone 17 Pro Max 256GB', price: 8190 },
    { label: 'iPhone 17 Pro Max 512GB', price: 9590 },
    { label: 'iPhone 17 Pro Max 1TB', price: 11290 },
    { label: 'iPhone 17 Pro Max 2TB', price: 13290 },
  ]},
  { group: 'iPhone 16', items: [
    { label: 'iPhone 16e 128GB', price: 4150 },
    { label: 'iPhone 16e 256GB', price: 4700 },
    { label: 'iPhone 16e 512GB', price: 0 },
    { label: 'iPhone 16 128GB', price: 4890 },
    { label: 'iPhone 16 256GB', price: 5250 },
    { label: 'iPhone 16 512GB', price: 0 },
    { label: 'iPhone 16 Pro 128GB', price: 6150 },
    { label: 'iPhone 16 Pro 256GB', price: 0 },
    { label: 'iPhone 16 Pro 512GB', price: 7150 },
    { label: 'iPhone 16 Pro Max 256GB', price: 7690 },
    { label: 'iPhone 16 Pro Max 512GB', price: 8190 },
    { label: 'iPhone 16 Pro Max 1TB', price: 0 },
  ]},
  { group: 'iPhone 15', items: [
    { label: 'iPhone 15 128GB', price: 4650 },
    { label: 'iPhone 15 256GB', price: 0 },
    { label: 'iPhone 15 512GB', price: 0 },
  ]},
  { group: 'Apple Watch', items: [
    { label: 'Apple Watch Series 11 42MM', price: 2890 },
    { label: 'Apple Watch Series 11 46MM', price: 2990 },
    { label: 'Apple Watch Series 10 42MM', price: 0 },
    { label: 'Apple Watch Series 10 46MM', price: 2900 },
    { label: 'Apple Watch SE 3 40MM', price: 2390 },
    { label: 'Apple Watch SE 3 44MM', price: 2600 },
    { label: 'Apple Watch Ultra 2 2023 49MM', price: 4890 },
    { label: 'Apple Watch Ultra 3 Natural 49MM', price: 6290 },
    { label: 'Apple Watch Ultra 3 Black 49MM', price: 5380 },
  ]},
  { group: 'MacBook Air M1/M2', items: [
    { label: 'MacBook Neo 256GB', price: 5190 },
    { label: 'MacBook Neo 512GB', price: 5790 },
    { label: 'MacBook Air M2 256GB', price: 0 },
    { label: 'MacBook Air M2 512GB', price: 6390 },
  ]},
  { group: 'MacBook Air M3', items: [
    { label: 'MacBook Air M3 512GB 13,6"', price: 6990 },
    { label: 'MacBook Air M3 256GB 15,3"', price: 0 },
    { label: 'MacBook Air M3 512GB 15,3"', price: 7550 },
  ]},
  { group: 'MacBook Air M4', items: [
    { label: 'MacBook Air M4 256GB 13,6"', price: 7050 },
    { label: 'MacBook Air M4 512GB 13,6"', price: 7790 },
    { label: 'MacBook Air M4 256GB 15,3"', price: 7990 },
    { label: 'MacBook Air M4 512GB 15,3"', price: 8990 },
  ]},
  { group: 'MacBook Pro M5', items: [
    { label: 'MacBook Pro M5 512GB 14,2"', price: 11950 },
    { label: 'MacBook Pro M5 1TB 14,2"', price: 12390 },
    { label: 'MacBook Pro M5 1TB 16,2"', price: 19790 },
  ]},
  { group: 'iPad', items: [
    { label: 'iPad Mini 7 128GB', price: 3850 },
    { label: 'iPad Mini 7 256GB', price: 4650 },
    { label: 'iPad 11 128GB', price: 2990 },
    { label: 'iPad 11 256GB', price: 3690 },
    { label: 'iPad Air M3 128GB', price: 4350 },
    { label: 'iPad Air M3 256GB', price: 5100 },
    { label: 'iPad Air M4 128GB', price: 4390 },
    { label: 'iPad Air M4 256GB', price: 5590 },
    { label: 'iPad Pro M5 256GB', price: 7100 },
    { label: 'iPad Pro M5 512GB', price: 7890 },
  ]},
  { group: 'AirPods', items: [
    { label: 'AirPods Pro 3', price: 1990 },
    { label: 'AirPods Pro 2', price: 1890 },
    { label: 'AirPods 4 (com ruído)', price: 1890 },
    { label: 'AirPods 4 (sem ruído)', price: 1450 },
    { label: 'AirPods 3', price: 1550 },
    { label: 'AirPods Max 2', price: 4890 },
  ]},
  { group: 'AirTag', items: [
    { label: 'AirTag Pack 1', price: 450 },
    { label: 'AirTag Pack 4', price: 890 },
  ]},
  { group: 'Acessórios', items: [
    { label: 'Apple Pencil USB-C', price: 1090 },
    { label: 'Apple Pencil 1 (c/ adaptador)', price: 990 },
    { label: 'Apple Pencil 2', price: 990 },
    { label: 'Apple Pencil Pro', price: 1250 },
    { label: 'Magic Mouse Preto', price: 1190 },
    { label: 'Magic Mouse Branco', price: 1190 },
  ]},
]

const USADOS = [
  { group: 'iPhone 17', items: [
    { label: 'iPhone 17 Air 128GB', price: 3800 },
    { label: 'iPhone 17 Air 256GB', price: 4000 },
    { label: 'iPhone 17 128GB', price: 4600 },
    { label: 'iPhone 17 256GB', price: 4800 },
    { label: 'iPhone 17 Pro 128GB', price: 5800 },
    { label: 'iPhone 17 Pro 256GB', price: 6000 },
    { label: 'iPhone 17 Pro Max 256GB', price: 6500 },
    { label: 'iPhone 17 Pro Max 512GB', price: 6800 },
  ]},
  { group: 'iPhone 16', items: [
    { label: 'iPhone 16e 128GB', price: 2500 },
    { label: 'iPhone 16e 256GB', price: 2600 },
    { label: 'iPhone 16 128GB', price: 4000 },
    { label: 'iPhone 16 256GB', price: 4100 },
    { label: 'iPhone 16 Pro 128GB', price: 5000 },
    { label: 'iPhone 16 Pro 256GB', price: 5100 },
    { label: 'iPhone 16 Pro Max 256GB', price: 5300 },
    { label: 'iPhone 16 Pro Max 512GB', price: 5800 },
  ]},
  { group: 'iPhone 15', items: [
    { label: 'iPhone 15 128GB', price: 2300 },
    { label: 'iPhone 15 256GB', price: 2400 },
    { label: 'iPhone 15 Plus 128GB', price: 2500 },
    { label: 'iPhone 15 Plus 256GB', price: 2600 },
    { label: 'iPhone 15 Pro 128GB', price: 3200 },
    { label: 'iPhone 15 Pro 256GB', price: 3400 },
    { label: 'iPhone 15 Pro 512GB', price: 3600 },
    { label: 'iPhone 15 Pro Max 256GB', price: 4500 },
    { label: 'iPhone 15 Pro Max 512GB', price: 4600 },
  ]},
  { group: 'iPhone 14', items: [
    { label: 'iPhone 14 128GB', price: 2000 },
    { label: 'iPhone 14 256GB', price: 2100 },
    { label: 'iPhone 14 Plus 128GB', price: 2500 },
    { label: 'iPhone 14 Plus 256GB', price: 2700 },
    { label: 'iPhone 14 Pro 128GB', price: 2500 },
    { label: 'iPhone 14 Pro 256GB', price: 2600 },
    { label: 'iPhone 14 Pro 512GB', price: 2700 },
    { label: 'iPhone 14 Pro Max 128GB', price: 3000 },
    { label: 'iPhone 14 Pro Max 256GB', price: 3100 },
    { label: 'iPhone 14 Pro Max 512GB', price: 3200 },
  ]},
  { group: 'iPhone 13', items: [
    { label: 'iPhone 13 Mini 128GB', price: 900 },
    { label: 'iPhone 13 Mini 256GB', price: 950 },
    { label: 'iPhone 13 128GB', price: 1600 },
    { label: 'iPhone 13 256GB', price: 1800 },
    { label: 'iPhone 13 512GB', price: 1900 },
    { label: 'iPhone 13 Pro 128GB', price: 2200 },
    { label: 'iPhone 13 Pro 256GB', price: 2300 },
    { label: 'iPhone 13 Pro 512GB', price: 2400 },
    { label: 'iPhone 13 Pro Max 128GB', price: 2500 },
    { label: 'iPhone 13 Pro Max 256GB', price: 2600 },
    { label: 'iPhone 13 Pro Max 512GB', price: 2700 },
  ]},
  { group: 'iPhone 12', items: [
    { label: 'iPhone 12 Mini 64GB', price: 700 },
    { label: 'iPhone 12 Mini 128GB', price: 750 },
    { label: 'iPhone 12 64GB', price: 1100 },
    { label: 'iPhone 12 128GB', price: 1100 },
    { label: 'iPhone 12 256GB', price: 1200 },
    { label: 'iPhone 12 Pro 128GB', price: 1300 },
    { label: 'iPhone 12 Pro 256GB', price: 1400 },
    { label: 'iPhone 12 Pro 512GB', price: 1500 },
    { label: 'iPhone 12 Pro Max 128GB', price: 1600 },
    { label: 'iPhone 12 Pro Max 256GB', price: 1700 },
    { label: 'iPhone 12 Pro Max 512GB', price: 1800 },
  ]},
  { group: 'iPhone 11', items: [
    { label: 'iPhone 11 64GB', price: 500 },
    { label: 'iPhone 11 128GB', price: 550 },
    { label: 'iPhone 11 256GB', price: 600 },
    { label: 'iPhone 11 Pro 64GB', price: 700 },
    { label: 'iPhone 11 Pro 256GB', price: 750 },
    { label: 'iPhone 11 Pro Max 64GB', price: 800 },
    { label: 'iPhone 11 Pro Max 256GB', price: 850 },
  ]},
  { group: 'Apple Watch', items: [
    { label: 'Apple Watch Series 4', price: 500 },
    { label: 'Apple Watch Series 5', price: 600 },
    { label: 'Apple Watch Series 6', price: 900 },
    { label: 'Apple Watch Series 7', price: 1000 },
    { label: 'Apple Watch Series 8', price: 1100 },
    { label: 'Apple Watch Series 9', price: 1200 },
    { label: 'Apple Watch Series 10 42MM', price: 1400 },
    { label: 'Apple Watch Series 10 46MM', price: 1500 },
    { label: 'Apple Watch Series 11 42MM', price: 1600 },
    { label: 'Apple Watch Series 11 46MM', price: 1700 },
    { label: 'Apple Watch SE 1ª Geração', price: 600 },
    { label: 'Apple Watch SE 2ª Geração', price: 700 },
    { label: 'Apple Watch SE 3ª Geração', price: 800 },
    { label: 'Apple Watch Ultra 1ª Geração', price: 2000 },
    { label: 'Apple Watch Ultra 2ª Geração', price: 2100 },
    { label: 'Apple Watch Ultra 3ª Geração', price: 2200 },
  ]},
  { group: 'iPad', items: [
    { label: 'iPad 9ª Geração 64GB', price: 800 },
    { label: 'iPad 9ª Geração 256GB', price: 900 },
    { label: 'iPad 10ª Geração 64GB', price: 1000 },
    { label: 'iPad 10ª Geração 256GB', price: 1100 },
    { label: 'iPad Air M1 64GB', price: 1200 },
    { label: 'iPad Air M1 256GB', price: 1400 },
    { label: 'iPad Air M2 128GB', price: 1600 },
    { label: 'iPad Air M2 256GB', price: 1800 },
    { label: 'iPad Air M3 128GB', price: 2000 },
    { label: 'iPad Air M3 256GB', price: 2200 },
    { label: 'iPad Pro M2 128GB', price: 2500 },
    { label: 'iPad Pro M2 256GB', price: 2700 },
    { label: 'iPad Pro M4 256GB', price: 3500 },
    { label: 'iPad Pro M4 512GB', price: 3800 },
  ]},
  { group: 'MacBook', items: [
    { label: 'MacBook Air M1 256GB', price: 2800 },
    { label: 'MacBook Air M1 512GB', price: 3200 },
    { label: 'MacBook Air M2 256GB', price: 3600 },
    { label: 'MacBook Air M2 512GB', price: 4000 },
    { label: 'MacBook Air M3 256GB', price: 4500 },
    { label: 'MacBook Air M3 512GB', price: 5000 },
    { label: 'MacBook Air M4 256GB', price: 5500 },
    { label: 'MacBook Air M4 512GB', price: 6000 },
    { label: 'MacBook Pro M3 512GB', price: 6500 },
    { label: 'MacBook Pro M3 1TB', price: 7000 },
    { label: 'MacBook Pro M4 512GB', price: 7500 },
    { label: 'MacBook Pro M4 1TB', price: 8000 },
  ]},
]

const AVARIA_DEFS = [
  { key: 'bat',  label: '🔋 Bateria',            def: 490 },
  { key: 'tam',  label: '🔲 Tampa Traseira',      def: 450 },
  { key: 'carc', label: '🛡️ Carcaça',             def: 200 },
  { key: 'face', label: '👁️ Face ID / Touch ID',  def: 300 },
  { key: 'cam',  label: '📷 Câmera',              def: 250 },
  { key: 'out',  label: '⚠️ Outro defeito',        def: 0   },
]

const TELA_MODELOS = [
  { label: 'Selecione modelo', val: 0 },
  { label: 'iPhone X — R$ 650', val: 650 },
  { label: 'iPhone XS — R$ 650', val: 650 },
  { label: 'iPhone XS Max — R$ 700', val: 700 },
  { label: 'iPhone XR — R$ 600', val: 600 },
  { label: 'iPhone 11 — R$ 600', val: 600 },
  { label: 'iPhone 11 Pro — R$ 690', val: 690 },
  { label: 'iPhone 11 Pro Max — R$ 720', val: 720 },
  { label: 'iPhone 12 / 12 Pro — R$ 730', val: 730 },
  { label: 'iPhone 12 Pro Max — R$ 848', val: 848 },
  { label: 'iPhone 12 Mini — R$ 785', val: 785 },
  { label: 'iPhone 13 — R$ 815', val: 815 },
  { label: 'iPhone 13 Pro — R$ 840', val: 840 },
  { label: 'iPhone 13 Pro Max — R$ 915', val: 915 },
  { label: 'iPhone 13 Mini — R$ 885', val: 885 },
  { label: 'iPhone 14 — R$ 820', val: 820 },
  { label: 'iPhone 14 Pro — R$ 1.150', val: 1150 },
  { label: 'iPhone 14 Pro Max — R$ 1.220', val: 1220 },
  { label: 'iPhone 15 — R$ 1.100', val: 1100 },
  { label: 'iPhone 15 Pro — R$ 1.180', val: 1180 },
  { label: 'iPhone 15 Pro Max — R$ 1.435', val: 1435 },
  { label: 'iPhone 16 — R$ 1.390', val: 1390 },
  { label: 'iPhone 16 Pro — R$ 1.600', val: 1600 },
  { label: 'iPhone 16 Pro Max — R$ 1.600', val: 1600 },
]

// ── DOM helpers ───────────────────────────────────────────────────
function makeSelect(groups, placeholder) {
  const sel = el('select', { class: 'orc-select' })
  sel.appendChild(el('option', { value: '' }, placeholder || 'Selecione ou digite abaixo'))
  for (const g of groups) {
    const og = document.createElement('optgroup')
    og.label = `── ${g.group} ──`
    for (const item of g.items) {
      const txt = item.price > 0
        ? `${item.label} — R$ ${item.price.toLocaleString('pt-BR')}`
        : `${item.label} — Indisponível`
      og.appendChild(el('option', { value: `${item.label}|${item.price}` }, txt))
    }
    sel.appendChild(og)
  }
  sel.appendChild(el('option', { value: '__custom__' }, 'Digitar manualmente...'))
  return sel
}

function makePfxWrap(inp) {
  return el('div', { class: 'orc-pfx-wrap' }, el('span', { class: 'orc-pfx' }, 'R$'), inp)
}

function makeSRow(ico, lbl, val, cls) {
  const valEl = el('div', { class: 'orc-sval' })
  valEl.textContent = val
  if (cls === 'orc-srow-green') valEl.classList.add('green')
  if (cls === 'orc-srow-red') valEl.classList.add('red')
  return el('div', { class: `orc-srow${cls ? ' ' + cls : ''}` },
    el('div', { class: 'orc-sico' }, ico),
    el('div', { class: 'orc-sinf' }, el('div', { class: 'orc-slbl' }, lbl), valEl),
  )
}

function copyText(text, btn) {
  const orig = btn.textContent
  const ok = () => {
    btn.textContent = 'Copiado ✓'
    btn.style.background = '#16a34a'
    setTimeout(() => { btn.textContent = orig; btn.style.background = '' }, 2200)
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(ok).catch(fallback)
  } else { fallback() }
  function fallback() {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0'
    document.body.appendChild(ta); ta.focus(); ta.select()
    try { document.execCommand('copy'); ok() } catch {}
    document.body.removeChild(ta)
  }
}

// ── Result panel builder (shared) ─────────────────────────────────
function buildResultCol(bigLbl) {
  const summWrap = el('div', { class: 'orc-summ' })
  const bigEl   = el('div', { class: 'orc-pblk-big' }, 'R$ 0,00')
  const vistaEl = el('div', { class: 'orc-pblk-vista-val' }, 'R$ 0,00')
  const plblEl  = el('div', { class: 'orc-pblk-plbl' })
  const pnumEl  = el('div', { class: 'orc-pblk-pnum' })
  const ptotEl  = el('div', { class: 'orc-pblk-ptot' })

  const pblk = el('div', { class: 'orc-pblk' },
    el('div', { class: 'orc-pblk-lbl' }, bigLbl),
    bigEl,
    el('div', { class: 'orc-pblk-acc' }),
    el('div', { class: 'orc-pblk-vista-lbl' }, 'À vista (cartão)'),
    vistaEl,
    el('div', { class: 'orc-pblk-acc2' }),
    plblEl, pnumEl, ptotEl,
  )

  const pillsWrap = el('div', { class: 'orc-pills' })
  const pillc = el('div', { class: 'orc-pillc' },
    el('div', { class: 'orc-pilll' }, 'Selecione o parcelamento'),
    pillsWrap,
  )

  const tbody = document.createElement('tbody')
  const tbli  = el('div', { class: 'orc-tbli' },
    el('table', { class: 'orc-tbl' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Parc.'), el('th', {}, 'Cobrar'), el('th', {}, 'Parcela'),
        el('th', {}, 'Taxa'), el('th', {}, 'Líquido'),
      )),
      tbody,
    )
  )
  const tblBtn = el('button', { type: 'button', class: 'orc-tblt' }, 'Ver tabela completa ▼')
  tblBtn.addEventListener('click', () => {
    tbli.classList.toggle('open')
    tblBtn.textContent = tbli.classList.contains('open') ? 'Ocultar tabela ▲' : 'Ver tabela completa ▼'
  })
  const tblc = el('div', { class: 'orc-tblc' }, tblBtn, tbli)

  const msgBody = el('div', { class: 'orc-msgb' })
  const copyBtn = el('button', { type: 'button', class: 'orc-copy-btn' }, 'Copiar')
  copyBtn.addEventListener('click', () => copyText(msgBody.textContent, copyBtn))
  const wppBtn = el('button', { type: 'button', class: 'orc-wpp-btn' }, '📲 Enviar')
  wppBtn.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent(msgBody.textContent)}`, '_blank'))

  const msgc = el('div', { class: 'orc-msgc' },
    el('div', { class: 'orc-msgh' },
      el('span', { class: 'orc-msght' }, '📲 Mensagem pronta'),
      el('div', { class: 'orc-msga' }, copyBtn, wppBtn),
    ),
    msgBody,
  )

  const resultBlock = el('div', { class: 'orc-result' }, summWrap, pblk, pillc, tblc)
  const disc = el('div', { class: 'orc-disc' })
  const col  = el('div', { class: 'orc-col-r' }, resultBlock, disc, msgc)

  return { col, summWrap, bigEl, vistaEl, plblEl, pnumEl, ptotEl, pillsWrap, tbody, resultBlock, disc, msgc, msgBody }
}

function updPblk(refs, liq, n, bigVal) {
  refs.bigEl.textContent = R(bigVal !== undefined ? bigVal : liq)
  const vista = cobrar(liq, 1)
  const sel   = cobrar(liq, n)
  const par   = sel / n
  refs.vistaEl.textContent = R(vista)
  if (n === 1) {
    refs.plblEl.textContent = ''
    refs.pnumEl.textContent = ''
    refs.ptotEl.textContent = ''
  } else {
    refs.plblEl.textContent = `Ou em ${n}x de`
    refs.pnumEl.textContent = R(par)
    refs.ptotEl.textContent = `Total parcelado: ${R(sel)}`
  }
}

function updPills(pillsWrap, liq, selN, onSelect) {
  pillsWrap.replaceChildren()
  for (let n = 1; n <= 12; n++) {
    const c   = cobrar(liq, n)
    const par = c / n
    const sub = el('span', { class: 'orc-pill-sub' }, n === 1 ? '1x à vista' : `${n}x`)
    const val = el('span', { class: 'orc-pill-val' }, n === 1 ? R(c) : R(par))
    const btn = el('button', { type: 'button', class: n === selN ? 'orc-pill active' : 'orc-pill' })
    btn.append(sub, val)
    ;((nn) => btn.addEventListener('click', () => onSelect(nn)))(n)
    pillsWrap.appendChild(btn)
  }
}

function updTbl(tbody, liq, selN) {
  tbody.replaceChildren()
  for (let n = 1; n <= 12; n++) {
    const c   = cobrar(liq, n)
    const t   = TX[n]
    const tax = (t.v + t.p).toFixed(2).replace('.', ',')
    const par = c / n
    tbody.appendChild(el('tr', { class: n === selN ? 'hl' : '' },
      el('td', {}, `${n}x`),
      el('td', { class: 'col-cobrar' }, R(c)),
      el('td', { class: 'col-parc' }, n === 1 ? '—' : R(par)),
      el('td', { class: 'col-parc' }, `${tax}%`),
      el('td', { class: 'col-liq' }, R(liq)),
    ))
  }
}

// ── Product row builder (shared) ──────────────────────────────────
function makeItemList(items, prodData, placeholder, totLabel) {
  const listWrap = el('div', { class: 'orc-list' })
  const totValEl = el('span', { class: 'orc-total-v' }, 'R$ 0,00')
  const totRow   = el('div', { class: 'orc-total-row', style: 'display:none' },
    el('span', { class: 'orc-total-l' }, totLabel), totValEl,
  )

  function updateTot() {
    const tot = items.reduce((s, i) => s + i.val, 0)
    if (items.length > 1) { totValEl.textContent = R(tot); totRow.style.display = 'flex' }
    else totRow.style.display = 'none'
  }

  function renderList() {
    listWrap.replaceChildren()
    const prodNomes = prodData.map(p => p.nome)
    items.forEach((item, i) => {
      const valInp = el('input', { type: 'number', class: 'orc-input', placeholder: '0,00', step: '50' })
      valInp.value = item.val > 0 ? item.val : ''

      const ac = createAutocomplete({
        placeholder,
        items:        prodNomes,
        initialValue: item.nome || '',
        onSelect: v => {
          const match = prodData.find(p => p.nome === v)
          items[i].nome = v
          if (match?.precoVenda > 0) {
            items[i].val  = match.precoVenda
            valInp.value  = match.precoVenda
            updateTot()
          }
        },
      })
      ac.el.classList.add('orc-input')
      ac.el.style.width = '100%'
      ac.el.addEventListener('input', () => { items[i].nome = ac.getValue() })
      valInp.addEventListener('input', () => { items[i].val = parseFloat(valInp.value) || 0; updateTot() })

      const rmBtn = el('button', { type: 'button', class: 'orc-prow-rm' }, '×')
      rmBtn.addEventListener('click', () => {
        if (items.length === 1) return
        items.splice(i, 1); renderList(); updateTot()
      })

      listWrap.appendChild(el('div', { class: 'orc-prow' },
        el('div', { class: 'orc-prow-s' }, ac.el),
        el('div', { class: 'orc-prow-v' }, el('span', { class: 'orc-prow-pfx' }, 'R$'), valInp),
        rmBtn,
      ))
    })
    updateTot()
  }

  renderList()
  return { listWrap, totRow, renderList }
}

// ── Message builders ──────────────────────────────────────────────
function msgParc(items, desc, liq, entrada, rest, cli) {
  const nome = cli || 'Baruker'
  const NL = '\n', L = '───────────────────'
  let m = `Olá, ${nome}! 😊${NL}${NL}*Orçamento — Baruk Store*${NL}${L}${NL}${NL}`
  if (items.length === 1) {
    m += `📦  ${items[0].nome}${NL}     Valor:  *${R(items[0].val)}*${NL}`
  } else {
    for (const it of items) m += `📦  ${it.nome}${NL}     *${R(it.val)}*${NL}`
  }
  if (desc > 0) m += `🏷️  Desconto:  *− ${R(desc)}*${NL}`
  m += `${NL}${L}${NL}${NL}*Formas de pagamento*${NL}${NL}`
  m += `💸  Pix / Dinheiro${NL}     *${R(liq)}*${NL}${NL}`
  if (entrada > 0) {
    m += `💵  Entrada${NL}     *${R(entrada)}*${NL}${NL}`
    if (rest > 0) m += `💳  Diferença${NL}     *${R(rest)}*${NL}${NL}`
  }
  const base = rest > 0 ? rest : liq
  if (base > 0) {
    m += (entrada > 0 ? '*Parcelamento:*' : '*Cartão de crédito:*') + `${NL}${NL}`
    for (let n = 1; n <= 12; n++) {
      const c = cobrar(base, n), p = c / n
      m += (n === 1 ? `1x  *${R(c)}*  (à vista)` : `${n}x  *${R(p)}*  — total ${R(c)}`) + NL
    }
  }
  return m + `${NL}${L}${NL}_Válido por 24h  ·  Baruk Store_${NL}_barukstore.com.br_`
}

function msgTroc(novos, usados, uvLiq, dc, dif, ent, rest, cli, avNames = []) {
  const nome = cli || 'Baruker'
  const NL = '\n', L = '───────────────────'
  let m = `Olá, ${nome}! 😊${NL}${NL}*Orçamento de Troca — Baruk Store*${NL}${L}${NL}${NL}`
  for (const it of usados) m += `🔄  Aparelho do cliente${NL}     ${it.nome}${NL}     Valor:  *${R(it.val)}*${NL}${NL}`
  if (avNames.length > 0) {
    m += `🔧  Problemas identificados${NL}`
    for (const n of avNames) m += `     • ${n}${NL}`
    m += NL
  }
  for (const it of novos)  m += `📦  Aparelho desejado${NL}     ${it.nome}${NL}     Valor:  *${R(it.val)}*${NL}`
  if (dc > 0) m += `🏷️  Desconto:  *− ${R(dc)}*${NL}`
  m += `${NL}${L}${NL}${NL}💳  Diferença a pagar:  *${R(dif)}*${NL}${NL}${L}${NL}${NL}`
  m += `*Formas de pagamento*${NL}${NL}`
  m += `💸  Pix / Dinheiro${NL}     *${R(dif)}*${NL}${NL}`
  if (ent > 0) {
    m += `💵  Entrada${NL}     *${R(ent)}*${NL}${NL}`
    if (rest > 0) m += `💳  Diferença${NL}     *${R(rest)}*${NL}${NL}`
  }
  const base = rest > 0 ? rest : dif
  m += (ent > 0 ? '*Parcelamento:*' : '*Cartão de crédito:*') + `${NL}${NL}`
  for (let n = 1; n <= 12; n++) {
    const c = cobrar(base, n), p = c / n
    m += (n === 1 ? `1x  *${R(c)}*  (à vista)` : `${n}x  *${R(p)}*  — total ${R(c)}`) + NL
  }
  return m + `${NL}${L}${NL}_Válido por 24h  ·  Baruk Store_${NL}_barukstore.com.br_`
}

// ── Parcelamento section ──────────────────────────────────────────
function buildParc(prodData) {
  let pItems = [{ nome: '', val: 0 }]
  let pNparc = 12

  const cliInp  = el('input', { type: 'text',   class: 'orc-input', placeholder: 'Nome do cliente' })
  const descInp = el('input', { type: 'number', class: 'orc-input orc-inp-money', placeholder: '0', value: '0', step: '50' })
  const entInp  = el('input', { type: 'number', class: 'orc-input orc-inp-money', placeholder: '0', value: '0', step: '50' })

  const { listWrap, totRow, renderList } = makeItemList(pItems, prodData, 'Buscar produto...', 'Total líquido')
  const refs = buildResultCol('Valor Líquido a Receber')
  refs.disc.textContent = 'Orçamento válido por 24h · Sujeito à disponibilidade de estoque'

  const addBtn = el('button', { type: 'button', class: 'orc-add-btn' }, '+ Adicionar produto')
  addBtn.addEventListener('click', () => { pItems.push({ nome: '', val: 0 }); renderList() })

  const calcBtn = el('button', { type: 'button', class: 'orc-calc-btn' }, 'Gerar Orçamento →')
  calcBtn.addEventListener('click', () => {
    const bruto   = pItems.reduce((s, i) => s + i.val, 0)
    const desc    = parseFloat(descInp.value) || 0
    const entrada = parseFloat(entInp.value)  || 0
    const liq     = Math.max(0, bruto - desc)
    const rest    = Math.max(0, liq - entrada)
    const cli     = cliInp.value.trim()
    const base    = rest > 0 ? rest : liq

    pNparc = 12
    refs.summWrap.replaceChildren()
    for (const it of pItems) {
      refs.summWrap.appendChild(makeSRow('📦', 'Produto',
        pItems.length > 1 ? `${it.nome} — ${R(it.val)}` : it.nome))
    }
    if (desc > 0)    refs.summWrap.appendChild(makeSRow('🏷️', 'Desconto',           `− ${R(desc)}`,  'orc-srow-red'))
    refs.summWrap.appendChild(              makeSRow('💸', 'Pix / Dinheiro',       R(liq),           'orc-srow-green'))
    if (entrada > 0) refs.summWrap.appendChild(makeSRow('💵', 'Entrada',            R(entrada),       'orc-srow-green'))
    if (rest > 0 && entrada > 0) refs.summWrap.appendChild(makeSRow('💳', 'Restante no cartão', R(rest)))

    updPblk(refs, base, pNparc, liq)

    let onPill
    onPill = (n) => {
      pNparc = n
      updPblk(refs, base, n, liq)
      updPills(refs.pillsWrap, base, n, onPill)
      updTbl(refs.tbody, base, n)
    }
    updPills(refs.pillsWrap, base, pNparc, onPill)
    updTbl(refs.tbody, base, pNparc)
    refs.msgBody.textContent = msgParc(pItems, desc, liq, entrada, rest, cli)
    refs.resultBlock.classList.add('visible')
    refs.disc.classList.add('visible')
    refs.msgc.classList.add('visible')
  })

  const colL = el('div', { class: 'orc-col-l' },
    el('div', { class: 'orc-card' },
      el('div', { class: 'field' }, el('label', {}, 'Cliente'), cliInp),
      el('div', { class: 'orc-sep' }),
      el('div', { class: 'orc-card-label' }, 'Produtos'),
      listWrap, addBtn, totRow,
    ),
    el('div', { class: 'orc-card' },
      el('div', { class: 'orc-row-2' },
        el('div', { class: 'field' }, el('label', {}, '💵 Entrada'), makePfxWrap(entInp)),
        el('div', { class: 'field' }, el('label', {}, '🏷️ Desconto'), makePfxWrap(descInp)),
      ),
    ),
    calcBtn,
  )

  const sec = el('div', { class: 'orc-section active' }, el('div', { class: 'orc-cols' }, colL, refs.col))
  return { sec, cliInp }
}

// ── Troca section ─────────────────────────────────────────────────
function buildTroca(prodData) {
  let tUsados = [{ nome: '', val: 0 }]
  let tNovos  = [{ nome: '', val: 0 }]
  let tNparc  = 12

  const avState = Object.fromEntries(AVARIA_DEFS.map(a => [a.key, { checked: false, val: a.def }]))
  const avTela  = { checked: false, val: 0 }

  const cliInp = el('input', { type: 'text',   class: 'orc-input', placeholder: 'Nome do cliente' })
  const dcInp  = el('input', { type: 'number', class: 'orc-input orc-inp-money', placeholder: '0', value: '0', step: '50' })
  const entInp = el('input', { type: 'number', class: 'orc-input orc-inp-money', placeholder: '0', value: '0', step: '50' })

  const { listWrap: usadoList, totRow: usadoTot, renderList: renderUsados } =
    makeItemList(tUsados, prodData, 'Buscar modelo...', 'Total na troca')
  const { listWrap: novoList,  totRow: novoTot,  renderList: renderNovos  } =
    makeItemList(tNovos,  prodData, 'Buscar produto...', 'Total desejado')

  const addUsadoBtn = el('button', { type: 'button', class: 'orc-add-btn orc-add-btn--trade' }, '+ Adicionar aparelho')
  addUsadoBtn.addEventListener('click', () => { tUsados.push({ nome: '', val: 0 }); renderUsados() })
  const addNovoBtn = el('button', { type: 'button', class: 'orc-add-btn' }, '+ Adicionar aparelho')
  addNovoBtn.addEventListener('click', () => { tNovos.push({ nome: '', val: 0 }); renderNovos() })

  // Avaria UI
  const avTotEl = el('span', { class: 'orc-avtotv' }, 'R$ 0,00')

  function calcAv() {
    let tot = 0
    for (const a of AVARIA_DEFS) { if (avState[a.key].checked) tot += avState[a.key].val }
    if (avTela.checked) tot += avTela.val
    avTotEl.textContent = R(tot)
    return tot
  }

  const avRows = AVARIA_DEFS.map(a => {
    const chk    = el('input', { type: 'checkbox', class: 'orc-avchk' })
    const valInp = el('input', { type: 'number', value: String(a.def), step: '10', class: 'orc-avval-inp' })
    chk.addEventListener('change', () => { avState[a.key].checked = chk.checked; calcAv() })
    valInp.addEventListener('input', () => { avState[a.key].val = parseFloat(valInp.value) || 0; calcAv() })
    const lbl = el('label', { class: 'orc-avnm' }, a.label)
    lbl.addEventListener('click', () => { chk.checked = !chk.checked; avState[a.key].checked = chk.checked; calcAv() })
    return el('div', { class: 'orc-avrow' },
      chk, lbl,
      el('div', { class: 'orc-avvw' }, el('span', { class: 'orc-avvw-pfx' }, 'R$'), valInp),
    )
  })

  // Tela row
  const telaChk    = el('input', { type: 'checkbox', class: 'orc-avchk' })
  const telaValInp = el('input', { type: 'number', value: '0', step: '10', class: 'orc-avval-inp' })
  const telaSel    = el('select', { class: 'orc-avsel' })
  for (const t of TELA_MODELOS) telaSel.appendChild(el('option', { value: String(t.val) }, t.label))
  telaSel.addEventListener('change', () => {
    const v = parseFloat(telaSel.value) || 0
    telaValInp.value = v > 0 ? String(v) : '0'
    avTela.val = v; calcAv()
  })
  telaChk.addEventListener('change',   () => { avTela.checked = telaChk.checked; calcAv() })
  telaValInp.addEventListener('input', () => { avTela.val = parseFloat(telaValInp.value) || 0; calcAv() })
  const telaLbl = el('label', { class: 'orc-avnm' }, '📱 Tela')
  telaLbl.addEventListener('click', () => { telaChk.checked = !telaChk.checked; avTela.checked = telaChk.checked; calcAv() })

  const telaRow = el('div', { class: 'orc-avrow orc-avrow-tela' },
    telaChk, telaLbl, telaSel,
    el('div', { class: 'orc-avvw' }, el('span', { class: 'orc-avvw-pfx' }, 'R$'), telaValInp),
  )

  const refs = buildResultCol('Diferença a Pagar')
  refs.disc.textContent = 'Orçamento válido por 24h · Sujeito à análise do aparelho usado'

  const calcBtn = el('button', { type: 'button', class: 'orc-calc-btn' }, 'Gerar Orçamento de Troca →')
  calcBtn.addEventListener('click', () => {
    const uvTot = tUsados.reduce((s, i) => s + i.val, 0)
    const nvTot = tNovos.reduce( (s, i) => s + i.val, 0)
    const dc    = parseFloat(dcInp.value)  || 0
    const ent   = parseFloat(entInp.value) || 0
    const av    = calcAv()
    const cli   = cliInp.value.trim()

    const uvLiq = Math.max(0, uvTot - av)
    const dif   = Math.max(0, nvTot - uvLiq - dc)
    const rest  = Math.max(0, dif - ent)
    const base  = rest > 0 ? rest : dif

    tNparc = 12
    refs.summWrap.replaceChildren()
    for (const it of tUsados) refs.summWrap.appendChild(makeSRow('🔄', 'Aparelho na troca', `${it.nome} — ${R(it.val)}`))
    if (av > 0) refs.summWrap.appendChild(makeSRow('🔧', 'Avarias (desc. interno)', `− ${R(av)}`, 'orc-srow-red'))
    for (const it of tNovos) refs.summWrap.appendChild(makeSRow('📦', 'Aparelho desejado', `${it.nome} — ${R(it.val)}`))
    if (dc > 0)  refs.summWrap.appendChild(makeSRow('🏷️', 'Desconto extra',        `− ${R(dc)}`,  'orc-srow-red'))
    refs.summWrap.appendChild(               makeSRow('💸', 'Diferença — Pix / Dinheiro', R(dif),  'orc-srow-green'))
    if (ent > 0) refs.summWrap.appendChild(makeSRow('💵', 'Entrada',               R(ent),          'orc-srow-green'))
    if (rest > 0 && ent > 0) refs.summWrap.appendChild(makeSRow('💳', 'Restante no cartão', R(rest)))

    updPblk(refs, base, tNparc, dif)

    let onPill
    onPill = (n) => {
      tNparc = n
      updPblk(refs, base, n, dif)
      updPills(refs.pillsWrap, base, n, onPill)
      updTbl(refs.tbody, base, n)
    }
    updPills(refs.pillsWrap, base, tNparc, onPill)
    updTbl(refs.tbody, base, tNparc)
    const avNames = []
    for (const a of AVARIA_DEFS) {
      if (avState[a.key].checked) avNames.push(a.label.replace(/^\S+\s+/, ''))
    }
    if (avTela.checked) avNames.splice(1, 0, 'Tela')
    refs.msgBody.textContent = msgTroc(tNovos, tUsados, uvLiq, dc, dif, ent, rest, cli, avNames)
    refs.resultBlock.classList.add('visible')
    refs.disc.classList.add('visible')
    refs.msgc.classList.add('visible')
  })

  const colL = el('div', { class: 'orc-col-l' },
    el('div', { class: 'orc-card' },
      el('div', { class: 'field' }, el('label', {}, 'Cliente'), cliInp),
    ),
    el('div', { class: 'orc-card orc-card--trade' },
      el('div', { class: 'orc-card-label' }, '📤 Aparelho do Cliente'),
      usadoList, addUsadoBtn, usadoTot,
    ),
    el('div', { class: 'orc-card orc-card--novo' },
      el('div', { class: 'orc-card-label' }, '✨ Aparelho Desejado'),
      novoList, addNovoBtn, novoTot,
    ),
    el('div', { class: 'orc-card' },
      el('div', { class: 'orc-row-2' },
        el('div', { class: 'field' }, el('label', {}, '💵 Entrada'), makePfxWrap(entInp)),
        el('div', { class: 'field' }, el('label', {}, '🏷️ Desconto'), makePfxWrap(dcInp)),
      ),
    ),
    el('div', { class: 'orc-avc' },
      el('div', { class: 'orc-avlbl' }, '🔧 Análise Interna'),
      el('div', { class: 'orc-avnota' }, '⚠️ Uso interno — descontos subtraídos do valor da troca. Problemas marcados aparecem na mensagem ao cliente.'),
      avRows[0],
      telaRow,
      ...avRows.slice(1),
      el('div', { class: 'orc-avtot' },
        el('span', { class: 'orc-avtotl' }, 'Total descontos internos'),
        avTotEl,
      ),
    ),
    calcBtn,
  )

  const sec = el('div', { class: 'orc-section' }, el('div', { class: 'orc-cols' }, colL, refs.col))
  return { sec, cliInp }
}

// ── Main ──────────────────────────────────────────────────────────
export async function render(container) {
  let prodData = []
  try {
    const snap = await getDocs(query(collection(db, 'produtos'), orderBy('nameLower')))
    prodData = snap.docs.map(d => ({ nome: d.data().nome, precoVenda: d.data().precoVenda || 0 }))
  } catch (e) {
    console.error('Erro ao carregar produtos para orçamento:', e)
  }

  const { sec: parcSec, cliInp: parcCli } = buildParc(prodData)
  const { sec: trocaSec, cliInp: trocaCli } = buildTroca(prodData)

  const tabParc = el('button', { type: 'button', class: 'orc-tab-btn active' }, '💳 Parcelamento')
  const tabTroc = el('button', { type: 'button', class: 'orc-tab-btn' }, '🔄 Troca')

  tabParc.addEventListener('click', () => {
    parcCli.value = trocaCli.value
    parcSec.classList.add('active');  trocaSec.classList.remove('active')
    tabParc.classList.add('active');  tabTroc.classList.remove('active')
  })
  tabTroc.addEventListener('click', () => {
    trocaCli.value = parcCli.value
    trocaSec.classList.add('active'); parcSec.classList.remove('active')
    tabTroc.classList.add('active');  tabParc.classList.remove('active')
  })

  mount(container,
    el('div', { class: 'orc-wrap' },
      el('div', { class: 'orc-tabs' }, tabParc, tabTroc),
      parcSec,
      trocaSec,
    )
  )
}
