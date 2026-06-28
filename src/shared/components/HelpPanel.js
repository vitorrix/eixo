import { el, mount } from '../utils/dom.js'

const TIPS = {
  '/': [
    { ico: '📊', txt: 'O Dashboard mostra o total de clientes e pedidos em tempo real via Firestore.' },
    { ico: '🔗', txt: 'Clique nos cards para navegar diretamente ao módulo correspondente.' },
  ],
  '/orcamentos': [
    { ico: '💳', txt: 'Na aba Parcelamento: busque o produto no campo de busca — o preço é preenchido automaticamente ao selecionar do catálogo.' },
    { ico: '🔄', txt: 'Na aba Troca: o nome do cliente e o aparelho desejado são sincronizados automaticamente com o Parcelamento.' },
    { ico: '🔧', txt: 'Análise Interna: marque os defeitos do aparelho trazido na troca. Os itens marcados aparecem na mensagem ao cliente com o valor do desconto.' },
    { ico: '📲', txt: 'Clique em "Enviar" para abrir o WhatsApp com a mensagem pronta.' },
    { ico: '👤', txt: 'Se o nome do cliente ficar em branco, a mensagem será enviada para "Baruker".' },
  ],
  '/pedidos': [
    { ico: '➕', txt: 'Clique em "+ Novo Pedido" para abrir o formulário. O campo de data é preenchido automaticamente com hoje.' },
    { ico: '🔍', txt: 'No campo cliente: comece a digitar o nome — o autocomplete busca no cadastro. Ou cadastre um cliente novo com "+ Cadastrar" sem sair do formulário.' },
    { ico: '📦', txt: 'Adicione quantos produtos quiser. O campo busca no catálogo e preenche valores automaticamente.' },
    { ico: '📋', txt: 'Use o Roteiro (ícone 📋 no topo) para ver todos os pedidos do dia organizados.' },
    { ico: '🔎', txt: 'Filtre por nome, status ou data. A lista atualiza em tempo real.' },
  ],
  '/clientes': [
    { ico: '➕', txt: 'Clique em "+ Novo Cliente" para cadastrar. O CEP preenche endereço automaticamente.' },
    { ico: '✏️', txt: 'Clique em qualquer cliente da lista para editar os dados.' },
    { ico: '📤', txt: 'Use o botão de exportação para baixar a lista completa em Excel.' },
    { ico: '🔍', txt: 'Busca em tempo real por nome ou telefone.' },
  ],
  '/configuracoes': [
    { ico: '💳', txt: 'Cadastre as formas de pagamento aceitas — elas aparecem no formulário de Pedidos.' },
    { ico: '➕', txt: 'Clique em "+ Adicionar" para incluir novas formas de pagamento.' },
  ],
}

let panelMounted = false
let panelEl, overlayEl, tipsList, panelTitle

function buildPanel() {
  if (panelMounted) return

  overlayEl = el('div', { class: 'help-overlay' })
  overlayEl.addEventListener('click', closeHelp)

  tipsList = el('ul', { class: 'help-tips-list' })

  const closeBtn = el('button', { class: 'help-close-btn', title: 'Fechar' }, '✕')
  closeBtn.addEventListener('click', closeHelp)

  panelTitle = el('div', { class: 'help-panel-title' }, '⚡ Dicas rápidas')

  const tutorialLink = el('a', { href: '#/ajuda', class: 'help-tutorial-link' }, '📖 Ver tutorial completo →')
  tutorialLink.addEventListener('click', closeHelp)

  panelEl = el('div', { class: 'help-panel' },
    el('div', { class: 'help-panel-header' }, panelTitle, closeBtn),
    tipsList,
    el('div', { class: 'help-panel-footer' }, tutorialLink),
  )

  document.body.appendChild(overlayEl)
  document.body.appendChild(panelEl)
  panelMounted = true
}

function closeHelp() {
  panelEl?.classList.remove('open')
  overlayEl?.classList.remove('open')
}

export function openHelp() {
  buildPanel()

  const path = window.location.hash.replace('#', '') || '/'
  const tips = TIPS[path] || []

  tipsList.replaceChildren()
  if (tips.length === 0) {
    tipsList.appendChild(el('li', { class: 'help-tip' },
      el('span', { class: 'help-tip-ico' }, 'ℹ️'),
      el('span', { class: 'help-tip-txt' }, 'Nenhuma dica disponível para esta página.'),
    ))
  } else {
    for (const t of tips) {
      tipsList.appendChild(el('li', { class: 'help-tip' },
        el('span', { class: 'help-tip-ico' }, t.ico),
        el('span', { class: 'help-tip-txt' }, t.txt),
      ))
    }
  }

  panelEl.classList.add('open')
  overlayEl.classList.add('open')
}
