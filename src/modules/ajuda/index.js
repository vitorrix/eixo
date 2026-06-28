import { el, mount } from '../../shared/utils/dom.js'

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

const TOPICS = [
  {
    id: 'dashboard',
    icon: '📊',
    label: 'Dashboard',
    intro: 'Visão geral do sistema em tempo real.',
    steps: [
      'Ao fazer login, você é direcionado automaticamente ao Dashboard.',
      'Os cards mostram o total de <strong>Clientes</strong> e <strong>Pedidos</strong> cadastrados, atualizados em tempo real.',
      'Clique em qualquer card para navegar diretamente ao módulo correspondente.',
    ],
    tips: [
      'Os números atualizam automaticamente — não é necessário recarregar a página.',
      'Novos módulos serão adicionados ao Dashboard conforme forem sendo implementados.',
    ],
  },
  {
    id: 'orcamentos-parc',
    icon: '💳',
    label: 'Orçamentos — Parcelamento',
    intro: 'Gere orçamentos com cálculo de parcelamento e mensagem pronta para WhatsApp.',
    steps: [
      '<strong>Nome do cliente</strong> (opcional): se deixar em branco, a mensagem será endereçada a "Baruker". Ao trocar para a aba Troca, o nome é levado automaticamente.',
      '<strong>Buscar produto</strong>: comece a digitar o nome — o autocomplete busca no catálogo. Ao selecionar, o preço de venda é preenchido automaticamente.',
      'Para adicionar mais produtos, clique em <strong>"+ Adicionar produto"</strong>.',
      '<strong>Entrada</strong>: valor que o cliente paga na hora (Pix ou dinheiro). Deixe em 0 se não houver.',
      '<strong>Desconto</strong>: valor abatido do total. Deixe em 0 se não houver.',
      'Clique em <strong>"Gerar Orçamento →"</strong> para calcular.',
      'Selecione o número de parcelas clicando nas <strong>pílulas</strong> (1x a 12x).',
      'Use <strong>"Copiar"</strong> para copiar a mensagem ou <strong>"📲 Enviar"</strong> para abrir o WhatsApp.',
    ],
    tips: [
      'O valor líquido (que a loja recebe) já desconta as taxas de cartão automaticamente.',
      'Clique em "Ver tabela completa" para ver todas as parcelas e taxas de uma vez.',
      'Se trocar para a aba Troca, o produto e o cliente são levados automaticamente.',
    ],
  },
  {
    id: 'orcamentos-troca',
    icon: '🔄',
    label: 'Orçamentos — Troca',
    intro: 'Calcule a diferença a pagar em uma troca de aparelho com análise interna de avarias.',
    steps: [
      '<strong>Aparelho do Cliente (âmbar)</strong>: busque o modelo que o cliente está trazendo e informe o valor de troca oferecido.',
      '<strong>Aparelho Desejado (verde)</strong>: busque o modelo que o cliente quer levar. Se você já gerou um orçamento de Parcelamento, este campo vem preenchido automaticamente.',
      '<strong>Análise Interna</strong>: marque os defeitos encontrados no aparelho do cliente. Os valores são descontados internamente do valor da troca. Os defeitos marcados aparecem na mensagem ao cliente.',
      '<strong>Entrada e Desconto</strong>: opcionais, funcionam igual ao Parcelamento.',
      'Clique em <strong>"Gerar Orçamento de Troca →"</strong> para calcular a diferença a pagar.',
      'Selecione as parcelas e use os botões de mensagem/WhatsApp normalmente.',
    ],
    tips: [
      'A Análise Interna é apenas para controle interno — os valores não aparecem no orçamento enviado ao cliente, mas os nomes dos defeitos sim.',
      'O campo "Tela" na análise interna tem valor padrão 0 — informe o valor do orçamento de troca de tela antes de marcar.',
      'O cliente e o produto desejado são sincronizados automaticamente com a aba Parcelamento.',
    ],
  },
  {
    id: 'pedidos',
    icon: '📋',
    label: 'Pedidos',
    intro: 'Registre e acompanhe os pedidos dos clientes.',
    steps: [
      'Clique em <strong>"+ Novo Pedido"</strong> para abrir o formulário. A data é preenchida com hoje automaticamente.',
      '<strong>Cliente</strong>: comece a digitar o nome no campo de busca. Se o cliente não existir, clique em <strong>"+ Cadastrar"</strong> para criar sem sair do formulário.',
      '<strong>Produtos</strong>: busque pelo nome no catálogo. O valor é preenchido automaticamente. Adicione quantos produtos quiser.',
      '<strong>Acessórios</strong>: use os botões rápidos (Capa, Película...) ou digite e pressione Enter para adicionar.',
      '<strong>Formas de pagamento</strong>: selecione uma ou mais formas. As opções vêm das Configurações.',
      'Clique em <strong>"Salvar"</strong> para registrar o pedido.',
      'Na lista de pedidos, use os <strong>filtros</strong> por nome, status ou data para encontrar pedidos rapidamente.',
      'Clique no ícone de <strong>Roteiro (📋)</strong> no topo para ver todos os pedidos do dia organizados em ordem.',
    ],
    tips: [
      'O campo de busca de clientes mostra sugestões ao começar a digitar — não é necessário digitar o nome completo.',
      'Pedidos são ordenados do mais recente para o mais antigo.',
      'O roteiro do dia é útil para organizar entregas e retiradas.',
    ],
  },
  {
    id: 'clientes',
    icon: '👥',
    label: 'Clientes',
    intro: 'Cadastro e gestão dos clientes da loja.',
    steps: [
      'Clique em <strong>"+ Novo Cliente"</strong> para abrir o formulário de cadastro.',
      'Preencha nome, telefone e e-mail. O campo de <strong>CEP</strong> preenche o endereço automaticamente ao digitar.',
      'Clique em <strong>"Salvar"</strong> — o cliente já fica disponível para uso nos módulos de Pedidos e Orçamentos.',
      'Para <strong>editar</strong>, clique no nome ou no ícone de edição na lista.',
      'Use o campo de <strong>busca</strong> no topo da lista para filtrar por nome ou telefone.',
      'Clique em <strong>"Exportar Excel"</strong> para baixar a lista completa em formato .xlsx.',
    ],
    tips: [
      'Clientes nunca são excluídos permanentemente — eles ficam inativos mas permanecem no histórico.',
      'O autocomplete de clientes nos Pedidos busca pelo cadastro em tempo real.',
    ],
  },
  {
    id: 'configuracoes',
    icon: '⚙️',
    label: 'Configurações',
    intro: 'Configure as opções operacionais do sistema.',
    steps: [
      'Acesse <strong>Configurações</strong> no menu lateral.',
      'Em <strong>Formas de Pagamento</strong>, clique em <strong>"+ Adicionar"</strong> para incluir novas opções (ex: Pix, Dinheiro, Cartão Débito).',
      'As formas cadastradas aparecem automaticamente no formulário de Pedidos.',
      'Para remover uma forma de pagamento, clique no <strong>✕</strong> ao lado dela.',
    ],
    tips: [
      'Cadastre todas as formas de pagamento aceitas antes de começar a registrar pedidos.',
    ],
  },
]

export function render(container) {
  let activeTopic = TOPICS[0].id

  const contentArea = el('div', { class: 'ajuda-content' })

  function renderTopic(id) {
    const topic = TOPICS.find(t => t.id === id)
    if (!topic) return
    activeTopic = id

    navItems.forEach(li => {
      li.classList.toggle('active', li.dataset.id === id)
    })

    const stepsEl = el('ol', { class: 'ajuda-steps' })
    for (const s of topic.steps) {
      const li = document.createElement('li')
      li.appendChild(parseStrong(s))
      stepsEl.appendChild(li)
    }

    const tipsEl = el('div', { class: 'ajuda-tips' })
    if (topic.tips?.length) {
      tipsEl.appendChild(el('div', { class: 'ajuda-tips-title' }, '💡 Dicas'))
      for (const t of topic.tips) {
        tipsEl.appendChild(el('div', { class: 'ajuda-tip' }, t))
      }
    }

    mount(contentArea,
      el('div', { class: 'ajuda-topic-header' },
        el('span', { class: 'ajuda-topic-ico' }, topic.icon),
        el('div', {},
          el('h2', { class: 'ajuda-topic-title' }, topic.label),
          el('p', { class: 'ajuda-topic-intro' }, topic.intro),
        ),
      ),
      stepsEl,
      tipsEl,
    )
  }

  const navItems = TOPICS.map(t => {
    const li = el('li', { class: 'ajuda-nav-item', 'data-id': t.id },
      el('span', {}, t.icon),
      el('span', {}, t.label),
    )
    li.addEventListener('click', () => renderTopic(t.id))
    return li
  })

  const nav = el('ul', { class: 'ajuda-nav' }, ...navItems)

  mount(container,
    el('div', { class: 'ajuda-wrap' },
      el('div', { class: 'ajuda-sidebar' },
        el('div', { class: 'ajuda-sidebar-title' }, '📖 Tutorial'),
        nav,
      ),
      contentArea,
    )
  )

  renderTopic(activeTopic)
}
