import { el, mount } from '../utils/dom.js'

const TIPS = {
  '/': [
    { ico: '📊', txt: 'O Mural de Recados mostra o que precisa de atenção hoje: pagamentos, pós-venda, aniversários e o status do bot.' },
    { ico: '📲', txt: 'Nos recados de pós-venda, o botão do WhatsApp abre a conversa com a mensagem pronta. Depois clique em "Feito ✓".' },
    { ico: '↩️', txt: 'Clicou em Feito sem querer? Abra "Pós-venda concluídos" no canto do Mural e use Reabrir.' },
  ],
  '/orcamentos': [
    { ico: '💳', txt: 'Parcelamento: busque o produto — o preço do catálogo é preenchido. As parcelas vão de 1x a 18x.' },
    { ico: '🔄', txt: 'Troca: cliente e aparelho desejado são levados do Parcelamento. A análise interna abate o valor da troca.' },
    { ico: '⬆️', txt: 'Upgrade: avalia o aparelho do cliente pela Tabela de Troca (Configurações) menos as avarias.' },
    { ico: '🕓', txt: 'Todo orçamento fica salvo na aba Histórico.' },
  ],
  '/pedidos': [
    { ico: '➕', txt: 'Anote serial/modelo nas Observações do pedido — o texto aparece no recibo do cliente.' },
    { ico: '✅', txt: 'Fluxo: Negociando → Pagamento → Confirmar Pgto → Logística → Entregue.' },
    { ico: '📦', txt: 'Ao confirmar o pagamento, marque "Já em estoque" no item para usar um aparelho que já foi comprado.' },
    { ico: '⚠️', txt: 'Editar um pedido já confirmado volta o fluxo para Negociando e refaz Compra/Venda/Financeiro.' },
  ],
  '/compras': [
    { ico: '🛒', txt: 'Uma Compra por aparelho. Pedidos geram as compras sozinhos; "+ Nova Compra" é para compras avulsas e estoque.' },
    { ico: '🔢', txt: 'Preencha "Dados do aparelho" (serial/IMEI): aparece no recibo do cliente.' },
  ],
  '/vendas': [
    { ico: '💰', txt: 'Uma venda por pedido (com todos os itens). A coluna Entrega pode ser alterada direto na linha.' },
    { ico: '🧾', txt: 'O botão Recibo abre o recibo para imprimir ou enviar pelo WhatsApp.' },
  ],
  '/busca': [
    { ico: '🔎', txt: 'Digite o produto (ex.: iPhone 17 Pro Max) para ver todos os fornecedores e comparar preços.' },
    { ico: '🎚️', txt: 'Filtre por capacidade, RAM, tamanho, cor e fornecedor; o filtro de Data esconde ofertas antigas.' },
    { ico: '📲', txt: 'O ícone do WhatsApp ao lado do fornecedor abre a conversa para perguntar.' },
  ],
  '/clientes': [
    { ico: '📜', txt: 'O botão Histórico mostra tudo do cliente: cadastro, compras (com recibo) e pedidos.' },
    { ico: '📍', txt: 'O CEP preenche o endereço sozinho.' },
    { ico: '🎂', txt: 'A data de nascimento gera o aviso de aniversário no Dashboard.' },
  ],
  '/leads': [
    { ico: '🖱️', txt: 'Arraste os cards entre as colunas: Em Follow-up, Sem Resposta, Convertido ou Descartado.' },
    { ico: '📝', txt: 'Em Follow-up, use "Nota" a cada contato e sempre reagende o retorno.' },
    { ico: '🕓', txt: 'Clique num card para ver a linha do tempo completa do atendimento.' },
  ],
  '/fornecedores': [
    { ico: '✅', txt: 'Fornecedor validado por videochamada ganha o selo na Busca.' },
    { ico: '⚙️', txt: 'A "Condição dos aparelhos" define se as ofertas dele entram como novas, semi-novas ou mistas.' },
  ],
  '/produtos': [
    { ico: '🏷️', txt: 'O preço de venda do catálogo é preenchido automaticamente em Orçamentos, Pedidos e Vendas.' },
    { ico: '📦', txt: 'Ligue o controle de estoque para acompanhar o estoque atual e o mínimo.' },
  ],
  '/financeiro': [
    { ico: '💵', txt: 'Duas abas: Recebimentos e Pagamentos. A caixinha da Situação marca como pago/recebido.' },
    { ico: '🔁', txt: 'Lançamento recorrente: informe dia do mês, data inicial e final para criar uma parcela por mês.' },
    { ico: '⚠️', txt: 'Excluir um lançamento é definitivo. Preencha sempre a categoria — ela define o lugar no DRE.' },
  ],
  '/motoboy': [
    { ico: '🏍️', txt: 'Novo acerto: importe as entregas do dia, abra cada trecho no Maps e digite o km. O total é km × valor do km + extras.' },
    { ico: '🛍️', txt: 'Acessório que o motoboy pagou? Use "+ Adicionar extra" — o valor entra no total a pagar.' },
    { ico: '💵', txt: 'Ao salvar, o acerto vira um Pagamento no Financeiro.' },
  ],
  '/relatorios': [
    { ico: '📈', txt: 'O DRE é por regime de caixa: conta o que foi pago/recebido de fato.' },
    { ico: '🖨️', txt: 'Todos os relatórios imprimem só o conteúdo, sem o menu.' },
  ],
  '/tarefas': [
    { ico: '✅', txt: 'Clique no status para avançar: Pendente → Em andamento → Concluída.' },
    { ico: '➕', txt: 'O botão + verde cria tarefas de qualquer tela.' },
  ],
  '/configuracoes': [
    { ico: '💳', txt: 'Cadastre formas de pagamento e contas antes de lançar pedidos.' },
    { ico: '🗂️', txt: 'Em Categorias, o "Grupo no DRE" define como o DRE é montado.' },
  ],
  '/usuarios': [
    { ico: '🔐', txt: 'Defina por módulo: Ver, Criar, Editar e Excluir. Relatórios, Configurações e Usuários são só do master.' },
    { ico: '👤', txt: 'O gênero do usuário é usado na mensagem de pós-venda ("Aqui é o/a ...").' },
  ],
}

// Rota -> tópico do tutorial que o link "Ver tutorial completo" deve abrir.
const TOPICO_POR_ROTA = {
  '/': 'dashboard', '/orcamentos': 'orcamentos', '/pedidos': 'pedidos', '/compras': 'compras',
  '/vendas': 'vendas', '/motoboy': 'motoboy', '/busca': 'busca', '/clientes': 'clientes', '/leads': 'leads',
  '/fornecedores': 'fornecedores', '/produtos': 'produtos', '/financeiro': 'financeiro',
  '/relatorios': 'relatorios', '/tarefas': 'tarefas', '/configuracoes': 'configuracoes',
  '/usuarios': 'usuarios',
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
  tutorialLink.addEventListener('click', () => {
    const topico = TOPICO_POR_ROTA[window.location.hash.replace('#', '') || '/']
    try { if (topico) sessionStorage.setItem('eixo:ajudaTopico', topico) } catch { /* abre no primeiro tópico */ }
    closeHelp()
  })

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
