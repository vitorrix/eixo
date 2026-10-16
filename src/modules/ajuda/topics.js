// Conteúdo do tutorial (módulo Ajuda). Texto simples com <strong> pra destaque —
// renderizado por parseStrong em index.js (nunca innerHTML).
//
// Estrutura:  GROUPS[] -> { label, topics[] }
//   topic:    { id, icon, label, intro, sections[], tips[]?, avisos[]? }
//   section:  { titulo, passos?: [], texto?: '', fluxo?: [] }
//
// Manter alinhado com o sistema: ao mudar uma tela, ajuste o tópico dela aqui.

export const GROUPS = [
  {
    label: 'Começando',
    topics: [
      {
        id: 'visao-geral',
        icon: '🧭',
        label: 'Visão geral do sistema',
        intro: 'Como o Eixo está organizado e o que tem em todas as telas.',
        sections: [
          {
            titulo: 'O caminho de uma venda',
            texto: 'O Eixo acompanha o negócio do primeiro contato até o dinheiro no caixa. Cada módulo cuida de uma etapa:',
            fluxo: ['Lead', 'Orçamento', 'Pedido', 'Compra + Venda', 'Entrega', 'Pós-venda', 'Financeiro / Relatórios'],
          },
          {
            titulo: 'Menu lateral',
            passos: [
              '<strong>Dashboard</strong>: resumo do dia, recados e tarefas.',
              '<strong>Financeiro, Orçamentos, Pedidos, Compras, Vendas</strong>: o dia a dia das vendas e do caixa.',
              '<strong>Busca</strong>: preços que os fornecedores mandam nas listas diárias.',
              '<strong>Clientes, Leads, Fornecedores, Produtos</strong>: cadastros e relacionamento.',
              '<strong>Relatórios, Configurações, Usuários</strong>: gestão (restritos ao usuário master).',
              'O botão <strong>‹</strong> no topo do menu encolhe a barra lateral. No rodapé fica a cotação do dólar em tempo real.',
            ],
          },
          {
            titulo: 'Barra do topo',
            passos: [
              '<strong>☀️/🌙 Tema</strong>: alterna entre tema claro e escuro (a escolha fica salva neste navegador).',
              '<strong>👁️ Ocultar valores</strong>: borra todos os valores em R$ da tela — use ao compartilhar a tela ou quando houver gente por perto. Clique de novo para mostrar.',
              '<strong>Sair</strong>: encerra a sessão.',
            ],
          },
          {
            titulo: 'Botões flutuantes (canto inferior direito)',
            passos: [
              '<strong>+ verde</strong>: cria uma tarefa rápida, de qualquer tela.',
              '<strong>? (ponto de interrogação)</strong>: dicas rápidas da tela em que você está, com atalho para este tutorial.',
            ],
          },
          {
            titulo: 'Quem vê o quê',
            texto: 'O usuário <strong>master</strong> acessa tudo. Os demais usuários enxergam só os módulos liberados em Usuários, com permissões separadas de <strong>Ver, Criar, Editar e Excluir</strong>. Se um botão não aparece para você, provavelmente falta essa permissão.',
          },
        ],
        tips: [
          'Telas de listas atualizam sozinhas: se alguém lançar algo em outro computador, aparece aqui sem recarregar.',
          'Clicar numa linha de quase qualquer lista abre um quadro com os detalhes daquele registro.',
        ],
      },
      {
        id: 'dashboard',
        icon: '📊',
        label: 'Dashboard',
        intro: 'A primeira tela do dia: o que precisa de atenção agora.',
        sections: [
          {
            titulo: 'Cartões de resumo',
            texto: 'No topo: total de <strong>Clientes</strong>, <strong>Pedidos</strong> do mês e quantidade de ofertas da <strong>Busca</strong> na última lista dos fornecedores. Clique num cartão para ir direto ao módulo.',
          },
          {
            titulo: 'Mural de Recados',
            texto: 'Avisos do dia, do mais urgente ao menos urgente:',
            passos: [
              '<strong>Alerta do bot do WhatsApp</strong>: aparece se o bot ficou sem sinal ou está instável (as listas dos fornecedores podem não estar entrando).',
              '<strong>Pagamentos e recebimentos</strong>: o que vence hoje e o total da semana, ainda não pago/recebido. O botão <strong>Detalhar</strong> abre o Financeiro já na aba certa (Pagamentos ou Recebimentos).',
              '<strong>Pós-venda</strong>: aparece 3 dias depois da entrega. Veja a seção "Pós-venda" abaixo.',
              '<strong>Aniversariantes</strong>: clientes que fazem aniversário hoje, com botão de WhatsApp com a mensagem de parabéns já escrita.',
            ],
          },
          {
            titulo: 'Pós-venda no Mural',
            passos: [
              'Clique no recado para ver os detalhes da venda (cliente, produto, valor, entrega, recibo).',
              'O botão <strong>WhatsApp</strong> abre a conversa com a mensagem-padrão já escrita (nome do cliente, o aparelho comprado e o seu nome). Você revisa e envia no próprio WhatsApp — o sistema não envia sozinho.',
              'Depois de dar o retorno, clique em <strong>Feito ✓</strong> para tirar o recado do Mural.',
              'Clicou em Feito sem querer, ou quer enviar a mensagem depois? Abra <strong>Pós-venda concluídos</strong> (link no canto do Mural): lá cada item mostra se o WhatsApp foi aberto ou se a mensagem não foi enviada, e tem os botões <strong>WhatsApp</strong> (enviar/reenviar) e <strong>Reabrir</strong> (volta para o Mural).',
            ],
          },
          {
            titulo: 'Faturamento',
            texto: 'O gráfico mostra os últimos 6 meses (Recebimentos já liquidados). Passe o mouse sobre uma barra para ver o valor do mês e a variação (▲/▼) em relação ao mês anterior.',
          },
          {
            titulo: 'Minhas Tarefas',
            texto: 'Suas tarefas em aberto, por prazo. Clique no status para avançar (pendente → em andamento → concluída). <strong>Ver todas as tarefas →</strong> abre a lista completa.',
          },
        ],
        tips: [
          'O alerta do bot some sozinho quando o sinal voltar — não precisa fazer nada no Eixo.',
          'Se o telefone do cliente não estiver cadastrado, o recado aparece sem o botão do WhatsApp.',
        ],
      },
    ],
  },

  {
    label: 'Vendas',
    topics: [
      {
        id: 'orcamentos',
        icon: '💳',
        label: 'Orçamentos',
        intro: 'Calcule parcelamentos, trocas e avaliações e mande a mensagem pronta pelo WhatsApp. São 4 abas.',
        sections: [
          {
            titulo: 'Aba Parcelamento',
            passos: [
              '<strong>Nome do cliente</strong> é opcional (em branco, a mensagem é para "Baruker").',
              'Em <strong>Buscar produto</strong>, digite o nome: o preço de venda do catálogo é preenchido ao selecionar. <strong>+ Adicionar produto</strong> inclui mais itens.',
              '<strong>Entrada</strong> (Pix/dinheiro na hora) e <strong>Desconto</strong> são opcionais.',
              'Clique em <strong>Gerar Orçamento →</strong> e escolha o parcelamento nas pílulas, de <strong>1x até 18x</strong>. <strong>Ver tabela completa</strong> mostra todas as parcelas e taxas de uma vez.',
              '<strong>Copiar</strong> copia a mensagem; <strong>Enviar</strong> abre o WhatsApp com ela pronta.',
              'Ligue <strong>Documento formal (PDF)</strong> para informar CPF/CNPJ do cliente e gerar o orçamento em PDF.',
            ],
          },
          {
            titulo: 'Aba Troca',
            passos: [
              '<strong>Aparelho do Cliente</strong> (âmbar): o modelo que ele traz e o valor de troca oferecido. É possível adicionar mais de um aparelho.',
              '<strong>Aparelho Desejado</strong> (verde): o que ele quer levar. Se você já fez um Parcelamento, vem preenchido.',
              '<strong>Análise interna</strong>: marque os defeitos do aparelho trazido (bateria, tela, tampa, carcaça, Face ID/Touch ID, câmera, outro). Os valores abatem o valor da troca; só os <strong>nomes</strong> dos defeitos vão para a mensagem ao cliente.',
              'O resultado mostra a <strong>Diferença a pagar</strong> — ou o <strong>Troco a devolver</strong> ao cliente quando o aparelho dele vale mais que o novo.',
            ],
          },
          {
            titulo: 'Aba Upgrade',
            passos: [
              'Avalia só o aparelho do cliente: busque o modelo (a lista vem da <strong>Tabela de Troca</strong> em Configurações) e o valor-base aparece.',
              'Marque as avarias na análise interna: o <strong>Valor Final do Aparelho</strong> é o valor-base menos os descontos.',
              'O aparelho avaliado vira automaticamente o "Aparelho do Cliente" na aba Troca.',
            ],
          },
          {
            titulo: 'Aba Histórico',
            texto: 'Todo orçamento gerado fica salvo automaticamente, com data, cliente, tipo (Parcelamento, Troca, Upgrade) e valor. Busque por cliente ou aparelho e clique numa linha para rever o orçamento.',
          },
        ],
        tips: [
          'O valor líquido (o que a loja recebe) já desconta as taxas do cartão.',
          'Cliente e produto são levados de uma aba para a outra automaticamente.',
          'O valor-base de cada aparelho no Upgrade é editado em Configurações → Tabela de Troca.',
        ],
      },
      {
        id: 'pedidos',
        icon: '📋',
        label: 'Pedidos',
        intro: 'O pedido acompanha a venda da negociação até a entrega. É dele que nascem a Compra, a Venda e os lançamentos do Financeiro.',
        sections: [
          {
            titulo: 'Etapas do pedido',
            fluxo: ['Negociando', 'Aguardando pagamento', 'Pago', 'Logística (Motoboy / Retirada / Correio)', 'Entregue'],
            texto: 'Em qualquer ponto antes do pagamento o pedido pode ser <strong>Cancelado</strong> (e depois reaberto). "Pago parcial" aparece quando só parte do pagamento foi liquidada.',
          },
          {
            titulo: '1. Criar o pedido',
            passos: [
              'Clique em <strong>+ Novo Pedido</strong>. A data vem como hoje.',
              '<strong>Cliente</strong>: comece a digitar o nome. Se não existir, use <strong>+ Cadastrar</strong> sem sair do formulário.',
              '<strong>Itens</strong>: aparelho/produto (busca no catálogo; informe a cor), manutenção ou acessório, cada um com valor, quantidade e desconto. Adicione quantos precisar.',
              '<strong>Troca</strong>: <strong>+ Adicionar troca</strong> registra o aparelho que o cliente entrega, o valor de crédito e as observações (estado, serial, IMEI). Pode haver mais de um.',
              '<strong>Formas de pagamento</strong>: uma ou mais, com o valor de cada (ex.: Pix R$ 3.000 + Cartão R$ 5.000).',
              '<strong>Observações</strong>: serial, modelo, detalhes do aparelho. <strong>Esse texto aparece no recibo do cliente</strong>.',
            ],
          },
          {
            titulo: '2. Pagamento',
            passos: [
              '<strong>Pagamento</strong>: passa o pedido de Negociando para Aguardando pagamento.',
              '<strong>Confirmar Pgto</strong>: o sistema pergunta se já vai <strong>efetuar a compra</strong>.',
              '<strong>Sim</strong>: abre o quadro de confirmação, onde para cada item você informa custo, fornecedor e dados do aparelho (serial/IMEI) e confirma como cada forma de pagamento foi liquidada. O sistema gera a <strong>Compra</strong>, a <strong>Venda</strong> e os <strong>lançamentos no Financeiro</strong>.',
              'Aparelho que já estava no estoque? Marque <strong>📦 Já em estoque</strong> no item e escolha a unidade — nenhuma Compra nova é criada, a existente é vinculada ao pedido.',
              '<strong>Não</strong>: só marca como pago. O botão <strong>Efetuar Compra</strong> continua disponível no pedido para lançar o custo depois — não esqueça, senão a venda fica sem custo e distorce o lucro.',
            ],
          },
          {
            titulo: '3. Entrega',
            passos: [
              '<strong>Logística</strong>: escolha <strong>Motoboy</strong>, <strong>Retirada</strong> ou <strong>Correio</strong>.',
              'No Motoboy abre o <strong>Roteiro de Entrega</strong>: monta a mensagem com as retiradas (loja/fornecedor de cada item) e o endereço do cliente, para copiar ou mandar pelo WhatsApp. O fornecedor já vem preenchido pelas Compras.',
              'Ao entregar, clique em <strong>Entregue</strong>: a Compra vira "concluída", a Venda fica como entregue e, após 3 dias, o pós-venda aparece no Dashboard.',
            ],
          },
          {
            titulo: 'Recibo',
            texto: 'Em pedidos pagos aparece o botão <strong>Recibo</strong> (veja o tópico "Recibos").',
          },
          {
            titulo: 'Editar, cancelar e excluir',
            passos: [
              '<strong>Editar</strong> funciona em qualquer status.',
              '<strong>Excluir/Cancelar</strong> (antes do pagamento) cancela o pedido; ele pode ser <strong>Reaberto</strong>.',
              'Um pedido cancelado pode ser <strong>excluído de vez</strong> (só quem tem permissão de excluir).',
            ],
          },
        ],
        avisos: [
          '<strong>Editar um pedido já confirmado volta o fluxo para Negociando</strong> e apaga a Compra, a Venda e os lançamentos que ele tinha gerado — eles são refeitos quando você confirmar o pagamento de novo. Compras que já estavam em estoque são devolvidas ao estoque, não apagadas.',
          '<strong>Excluir um pedido apaga também a Compra, a Venda e os lançamentos financeiros ligados a ele.</strong> Não há como desfazer.',
        ],
        tips: [
          'Use os filtros de período, status e a busca por cliente/produto para achar pedidos rápido.',
          'Clique em qualquer linha para ver os detalhes do pedido.',
          'Escreva o serial/IMEI nas Observações do pedido (ou em "Dados do aparelho" da Compra): é o que aparece no recibo.',
        ],
      },
      {
        id: 'compras',
        icon: '🛒',
        label: 'Compras',
        intro: 'O que a loja comprou: custo, fornecedor e dados de cada aparelho. É daqui que sai o custo do produto vendido.',
        sections: [
          {
            titulo: 'De onde vêm as Compras',
            passos: [
              '<strong>Automáticas</strong>: o Pedido gera uma Compra por aparelho quando o pagamento é confirmado (nasce "Aguardando" e vira "Concluído" na entrega).',
              '<strong>Troca do cliente</strong>: o aparelho que ele entrega vira uma Compra (fornecedor = o cliente) e, quando o pedido é entregue, entra no <strong>Estoque</strong>.',
              '<strong>Avulsas</strong>: <strong>+ Nova Compra</strong> lança uma compra direta — aparelho para estoque, compra em lote de acessórios, nota com vários itens (<strong>+ Adicionar item</strong>).',
            ],
          },
          {
            titulo: 'Campos importantes',
            passos: [
              '<strong>Produto</strong>, <strong>Fornecedor ou cliente</strong>, <strong>Custo</strong> (unitário) e <strong>Quantidade</strong>.',
              '<strong>Dados do aparelho</strong>: specs, serial, IMEI. <strong>Aparece no recibo do cliente</strong> — deixe em branco para lote sem serial, como acessórios.',
              '<strong>Status</strong>: Aguardando, Estoque (disponível para vender) ou Concluído (já foi para um cliente).',
            ],
          },
          {
            titulo: 'Aparelho em estoque',
            texto: 'Compras com status <strong>Estoque</strong> ficam disponíveis para serem puxadas em um Pedido (opção "Já em estoque" na confirmação de pagamento). O serial e os dados do aparelho acompanham a unidade até o recibo.',
          },
        ],
        tips: [
          'Clique em uma linha para ver os detalhes da compra.',
          'Busque por produto, fornecedor ou cliente; ordene clicando no cabeçalho das colunas.',
        ],
      },
      {
        id: 'vendas',
        icon: '💰',
        label: 'Vendas',
        intro: 'O registro de cada venda: itens, valor, forma de pagamento, entrega e recibo.',
        sections: [
          {
            titulo: 'Como a venda nasce',
            passos: [
              '<strong>Vinda de pedido</strong>: criada automaticamente ao confirmar o pagamento — uma venda por pedido, com todos os itens dentro.',
              '<strong>Avulsa</strong>: <strong>+ Nova Venda</strong> para uma venda direta, sem pedido (cliente, produto do catálogo, valor, pagamento e entrega).',
            ],
          },
          {
            titulo: 'Na lista',
            passos: [
              'A coluna <strong>Entrega</strong> é editável direto na linha: Aguardando, Retirada, Motoboy, Correio ou Entregue.',
              'O botão <strong>Recibo</strong> abre o recibo da venda (veja "Recibos").',
              'Clique na linha para ver os detalhes. Filtre por período e busque por cliente ou produto.',
            ],
          },
        ],
        avisos: [
          'Excluir uma venda que veio de pedido também apaga o Recebimento gerado no Financeiro.',
        ],
        tips: [
          'A venda é o que alimenta os relatórios de vendas (margem por venda, ranking e curva ABC).',
        ],
      },
      {
        id: 'recibos',
        icon: '🧾',
        label: 'Recibos',
        intro: 'O comprovante enviado ao cliente: itens, pagamento e dados do aparelho.',
        sections: [
          {
            titulo: 'Onde abrir',
            passos: [
              'Em <strong>Pedidos</strong> (pedidos pagos), em <strong>Vendas</strong>, no <strong>Histórico do cliente</strong> (cada compra tem seu botão Recibo) e em <strong>Relatórios → E-gestor</strong> (compras do sistema anterior).',
            ],
          },
          {
            titulo: 'O que sai no recibo',
            passos: [
              'Dados da empresa (de Configurações → Empresa), do cliente, a tabela de itens, o pagamento e o total.',
              'O bloco <strong>Observações</strong> reúne os <strong>dados do aparelho</strong>: o que foi escrito em "Dados do aparelho" na Compra de cada item e o campo "Observações" do Pedido. Texto repetido não aparece duas vezes.',
            ],
          },
          {
            titulo: 'Imprimir e enviar',
            passos: [
              '<strong>Imprimir / PDF</strong>: abre a janela de impressão do navegador (que também permite salvar em PDF). Em Detalhes, o botão Imprimir já abre o recibo e manda imprimir.',
              '<strong>Enviar por WhatsApp</strong>: coloca o recibo na fila e o <strong>bot</strong> manda o PDF para o telefone do cliente em instantes. O status mostra "Na fila de envio…", "Enviado" ou "Erro". Precisa de cliente com telefone cadastrado.',
            ],
          },
        ],
        tips: [
          'O recibo é sempre claro (papel branco), mesmo com o tema escuro ligado.',
          'Se o envio ficar na fila por muito tempo, veja o alerta do bot no Dashboard — o bot pode estar sem sinal.',
          'No aplicativo instalado (atalho do Mac) o botão Imprimir pode não abrir a janela; no navegador funciona normalmente.',
        ],
      },
      {
        id: 'busca',
        icon: '🔎',
        label: 'Busca (preços dos fornecedores)',
        intro: 'Compare o preço de um produto em todos os fornecedores. Os dados vêm das listas que eles mandam nos grupos de WhatsApp, lidas pelo bot.',
        sections: [
          {
            titulo: 'Como usar',
            passos: [
              'Digite o produto, a variante ou o fornecedor (ex.: <strong>iPhone 17 Pro Max</strong>). A lista mostra todos os fornecedores que têm o produto, do menor preço ao maior.',
              'Refine pelos filtros: <strong>Capacidade, Memória RAM, Tamanho, Cor e Fornecedor</strong> (vários valores ao mesmo tempo), pela origem (Americano, Japonês, Europeu etc.) e por <strong>Novo/Semi-novo</strong>, <strong>Apple/Acessórios</strong>.',
              'O filtro <strong>Data</strong> esconde ofertas cotadas antes daquele dia.',
              'O ícone do <strong>WhatsApp</strong> ao lado do fornecedor abre a conversa para perguntar sobre o produto. O selo de <strong>validado</strong> indica fornecedor já verificado por videochamada.',
            ],
          },
        ],
        tips: [
          'Os nomes de cores são padronizados na entrada (ex.: "Burgundy" vira "Bordô" no iPhone 18 Pro Max) para o filtro não ficar com várias grafias da mesma cor.',
          'Cada fornecedor tem só o preço atual: uma lista nova do mesmo fornecedor substitui o preço anterior.',
          'Se as ofertas pararem de atualizar, confira o alerta do bot no Dashboard.',
        ],
      },
    ],
  },

  {
    label: 'Relacionamento',
    topics: [
      {
        id: 'leads',
        icon: '💬',
        label: 'Leads',
        intro: 'O funil de atendimento: cada pessoa que chama no WhatsApp ou no Instagram vira um lead, com histórico de todas as tentativas de contato.',
        sections: [
          {
            titulo: 'O Quadro',
            texto: 'Cinco colunas: <strong>Novo → Em Follow-up → Sem Resposta → Convertido / Descartado</strong>. Os leads entram sozinhos em "Novo" (WhatsApp direto, anúncios e Instagram Direct), com ícone do canal. No topo, números separados por canal.',
          },
          {
            titulo: 'Atendendo um lead',
            passos: [
              'Arraste o card de <strong>Novo</strong> para <strong>Em Follow-up</strong>: o sistema pede o que foi tratado, o <strong>nível de interesse</strong> (⭐ a ⭐⭐⭐) e <strong>quando retornar</strong>.',
              'Em Follow-up, o botão <strong>Nota</strong> registra cada novo contato (e a tentativa conta +1). O card mostra o retorno agendado; passou da hora, fica <strong>atrasado</strong> em vermelho.',
              '<strong>📞 Chamada perdida</strong> marca prioridade: o card sobe para o topo da coluna. Clique de novo para desmarcar.',
              'Arraste para <strong>Sem Resposta</strong> quando o cliente parar de responder; dá para reagendar e voltar ao Follow-up.',
              'Arraste para <strong>Convertido</strong> quando a venda for fechada — o sistema oferece abrir o cadastro do cliente (ou só marcar como convertido).',
              'Arraste para <strong>Descartado</strong> e informe o <strong>motivo</strong> (e uma anotação opcional).',
              '🗑️ <strong>Remover</strong> (só em Novo) é para lixo: mensagem vazia, teste, engano. Não entra em nenhum histórico.',
            ],
          },
          {
            titulo: 'Histórico do atendimento',
            passos: [
              'Clique em qualquer card para abrir a <strong>linha do tempo</strong> do lead: a primeira mensagem, cada tentativa de contato (quem fez, quando e o comentário) e o desfecho.',
              'Na aba <strong>Histórico</strong> ficam os leads encerrados (Convertido, Descartado, Sem Resposta). Filtre por período, status, motivo ou nome/telefone, e use <strong>Ver atendimento</strong> em cada linha. O link <strong>+N no Histórico</strong> do Quadro leva direto para cá.',
            ],
          },
        ],
        tips: [
          'Clique no nome do lead para renomear e no telefone para corrigir.',
          'Sempre reagende o retorno ao registrar um contato: lead com data vencida aparece como atrasado e acende o contador no menu.',
        ],
      },
      {
        id: 'clientes',
        icon: '👥',
        label: 'Clientes',
        intro: 'O cadastro de clientes e tudo o que cada um já fez com a loja.',
        sections: [
          {
            titulo: 'Cadastro',
            passos: [
              '<strong>+ Novo Cliente</strong>: pessoa física ou jurídica, nome, documento, telefone, e-mail, data de nascimento e endereço (o <strong>CEP</strong> preenche o endereço sozinho).',
              'O <strong>telefone</strong> é usado nos envios por WhatsApp; a <strong>data de nascimento</strong> alimenta os avisos de aniversário no Mural.',
              '<strong>↑ Importar XLS</strong> carrega uma planilha de clientes de uma vez.',
              'Busque por nome, documento ou e-mail e ordene clicando nas colunas.',
            ],
          },
          {
            titulo: 'Botão Histórico',
            texto: 'Em cada cliente (na lista e dentro do cadastro) o botão <strong>Histórico</strong> abre:',
            passos: [
              '<strong>Resumo</strong>: número de compras, total comprado, ticket médio e última compra.',
              '<strong>Cadastro</strong>: quando foi criado e a data da última alteração.',
              '<strong>Compras</strong>: cada venda com data, itens, pagamento, entrega e valor — e o botão <strong>Recibo</strong> de cada uma.',
              '<strong>Pedidos em andamento</strong> (que ainda não viraram venda) e as <strong>compras do sistema anterior</strong> (E-gestor).',
            ],
          },
        ],
        tips: [
          'O Eixo guarda a data da última alteração do cadastro, não o detalhe de cada mudança.',
          'As compras do sistema anterior aparecem quando o nome do cliente é igual ao do E-gestor.',
        ],
      },
    ],
  },

  {
    label: 'Cadastros',
    topics: [
      {
        id: 'fornecedores',
        icon: '🏭',
        label: 'Fornecedores',
        intro: 'Os fornecedores de aparelhos e acessórios, ligados à Busca e às Compras.',
        sections: [
          {
            titulo: 'Cadastro',
            passos: [
              '<strong>+ Novo Fornecedor</strong>: razão social, CNPJ, telefone/WhatsApp, e-mail, endereço (CEP automático), nome do vendedor, <strong>Box / identificação na galeria</strong> e observações.',
              '<strong>Trabalha com</strong>: Apple ou Acessórios.',
              '<strong>Condição dos aparelhos</strong>: Só novo/lacrado, Só semi-novo, ou Misto. Isso define como as ofertas desse fornecedor são classificadas na Busca.',
              '<strong>Comunidade</strong>: marque se ele está no grupo que envia a lista diária de aparelhos.',
            ],
          },
          {
            titulo: 'Validação',
            texto: 'O fornecedor pode ser <strong>validado por chamada de vídeo</strong>. A validade tem prazo e o cadastro mostra até quando vale. Fornecedor validado recebe o selo na Busca.',
          },
        ],
        tips: ['O botão do WhatsApp na lista abre a conversa com o fornecedor.'],
      },
      {
        id: 'produtos',
        icon: '🏷️',
        label: 'Produtos (catálogo)',
        intro: 'O catálogo de produtos com preço, custo e estoque. Alimenta Orçamentos, Pedidos e Vendas.',
        sections: [
          {
            titulo: 'Cadastro',
            passos: [
              '<strong>+ Novo Produto</strong>: nome (ex.: iPhone 17 Pro Max 256GB), categoria, <strong>preço de custo</strong> e <strong>preço de venda</strong>. A <strong>margem</strong> é calculada sozinha.',
              'Ligue o controle de estoque para informar <strong>estoque atual</strong> e <strong>estoque mínimo</strong>. O estoque baixa a cada venda e sobe a cada compra.',
              'Busque por nome ou categoria; ordene pelas colunas Nome, Categoria, Custo, Venda, Margem e Estoque.',
            ],
          },
        ],
        tips: [
          'O preço de venda do catálogo é o que aparece automaticamente ao escolher o produto em Orçamentos, Pedidos e Vendas.',
          'Produtos não têm imagem por enquanto.',
        ],
      },
    ],
  },

  {
    label: 'Financeiro e Relatórios',
    topics: [
      {
        id: 'financeiro',
        icon: '💵',
        label: 'Financeiro',
        intro: 'Tudo o que entra e sai do caixa, em duas abas: <strong>Recebimentos</strong> e <strong>Pagamentos</strong>.',
        sections: [
          {
            titulo: 'Na tela',
            passos: [
              'Escolha a aba, o <strong>período</strong> (padrão: Este mês) e busque por descrição ou contato. Os cartões do topo somam o total, o liquidado e o pendente do período.',
              'A coluna <strong>Data</strong> mostra o vencimento dos pendentes e a data de pagamento/recebimento dos liquidados; a lista ordena por essa mesma data.',
              'A caixinha da coluna <strong>Situação</strong> marca como pago/recebido (ou volta para pendente).',
              'Clique numa linha para ver os detalhes do lançamento.',
            ],
          },
          {
            titulo: 'Lançamentos',
            passos: [
              '<strong>Automáticos</strong>: o Pedido gera os lançamentos sozinho — o <strong>Recebimento</strong> da venda e os <strong>Pagamentos</strong> das compras e das trocas. Eles só podem ser <strong>excluídos</strong>, não editados.',
              '<strong>+ Novo Recebimento / + Novo Pagamento</strong>: lançamento avulso (conta de luz, salário, empréstimo...) com descrição, valor, contato, categoria, conta, forma de pagamento, vencimento e observações.',
              '<strong>Recorrente</strong>: informe o dia do mês, a data inicial e a final — o sistema cria um lançamento por mês no período (ex.: parcelas de um empréstimo).',
            ],
          },
        ],
        avisos: [
          '<strong>Excluir um lançamento apaga na hora e não tem volta.</strong> Em lançamentos de uma série recorrente, cada exclusão remove só aquela parcela — confira antes de confirmar.',
        ],
        tips: [
          'A <strong>categoria</strong> define onde o valor cai no DRE. Lançamento sem categoria some das somas por categoria — sempre preencha.',
          'O botão Detalhar dos recados do Dashboard abre aqui já na aba correta.',
        ],
      },
      {
        id: 'relatorios',
        icon: '📈',
        label: 'Relatórios',
        intro: 'Oito relatórios para entender o resultado do negócio (acesso do master).',
        sections: [
          {
            titulo: 'Os relatórios',
            passos: [
              '<strong>DRE</strong>: resultado do período em <strong>regime de caixa</strong> (conta o que foi pago/recebido de fato), por grupo e subgrupo de categoria, com indicadores de margem.',
              '<strong>Vendas Detalhadas</strong>: a margem de cada venda (valor, custo, lucro).',
              '<strong>Vendas por Produto</strong>: ranking dos produtos mais vendidos.',
              '<strong>ABC de Produtos</strong>: curva ABC de faturamento.',
              '<strong>Fluxo Financeiro</strong>: receitas x despesas por categoria.',
              '<strong>Fluxo de Caixa Periódico</strong>: evolução mês a mês.',
              '<strong>Por Categoria/Contato</strong>: quanto foi gasto com cada categoria ou contato, com extrato imprimível.',
              '<strong>E-gestor</strong>: consulta das vendas do sistema anterior (busca por cliente, produto ou período) e emissão de recibo delas.',
            ],
          },
          {
            titulo: 'Período e impressão',
            texto: 'Todos usam o seletor de período (Hoje, Esta semana, Últimos 30 dias, Este mês, Mês passado, datas à escolha). A impressão do navegador esconde o menu e imprime só o relatório.',
          },
        ],
        avisos: [
          'O DRE é por caixa e as telas de Vendas são por data da venda — por isso os números podem divergir no mesmo mês. Conferir o DRE com o Financeiro (e não com Vendas) evita confusão. Pedido pago sem "Efetuar Compra" não tem o custo lançado, então o custo dele não entra no DRE.',
        ],
      },
    ],
  },

  {
    label: 'Gestão',
    topics: [
      {
        id: 'tarefas',
        icon: '✅',
        label: 'Tarefas',
        intro: 'Pendências da equipe com responsável, prazo e prioridade.',
        sections: [
          {
            titulo: 'Como usar',
            passos: [
              'Crie pelo botão <strong>+ verde</strong> (qualquer tela) ou por <strong>+ Nova Tarefa</strong> na lista: título, descrição, responsável(is), prazo e prioridade (alta, média, baixa).',
              'Clique no status para avançar: <strong>Pendente → Em andamento → Concluída</strong>.',
              'Tarefa com prazo vencido fica destacada. A lista completa está em <strong>Ver todas as tarefas →</strong> no Dashboard e pode ser ordenada por prioridade, prazo, responsável e status.',
            ],
          },
        ],
        tips: ['O Dashboard mostra só as suas tarefas em aberto, por prazo.'],
      },
      {
        id: 'configuracoes',
        icon: '⚙️',
        label: 'Configurações',
        intro: 'Dados de base que o resto do sistema usa (acesso do master). Cinco abas.',
        sections: [
          {
            titulo: 'As abas',
            passos: [
              '<strong>Empresa</strong>: razão social, nome fantasia, endereço e telefones. Aparecem no recibo e nos orçamentos em PDF.',
              '<strong>Formas de Pagamento</strong>: Pix, cartão, dinheiro etc., cada uma com sua <strong>conta padrão</strong> de destino. Alimentam Pedidos, Vendas e o Financeiro.',
              '<strong>Contas</strong>: as contas/destinos do dinheiro (ex.: Nubank).',
              '<strong>Categorias</strong>: categorias de receita e despesa. Cada uma tem <strong>Grupo no DRE</strong> e subgrupo (ex.: Custo dos Produtos Vendidos, Despesas Operacionais), que define como o DRE é montado.',
              '<strong>Tabela de Troca</strong>: valor-base de cada aparelho (1 valor por modelo) usado na aba Upgrade dos Orçamentos; <strong>+ Adicionar modelo</strong> inclui um modelo novo.',
            ],
          },
        ],
        tips: ['Cadastre formas de pagamento e contas antes de começar a lançar pedidos.'],
        avisos: ['Cada aba tem seu próprio botão <strong>Salvar</strong> — salve antes de trocar de aba.'],
      },
      {
        id: 'usuarios',
        icon: '🔐',
        label: 'Usuários e permissões',
        intro: 'Quem acessa o sistema e o que cada pessoa pode fazer (acesso do master).',
        sections: [
          {
            titulo: 'Gerenciar',
            passos: [
              '<strong>+ Novo Usuário</strong>: nome, e-mail, senha provisória, <strong>gênero</strong> e as permissões.',
              '<strong>Gênero</strong> é usado na mensagem de pós-venda ("Aqui é o Vitor" / "Aqui é a Ana"); dá para alterar na própria lista.',
              '<strong>Permissões</strong>: por módulo (Pedidos, Compras, Vendas, Clientes, Leads, Fornecedores, Produtos, Orçamentos, Busca, Financeiro) marque Ver, Criar, Editar e Excluir.',
              '<strong>Desativar</strong> tira o acesso sem apagar o histórico — usuários nunca são excluídos.',
            ],
          },
        ],
        tips: ['Relatórios, Configurações e Usuários são sempre exclusivos do master.'],
      },
    ],
  },

  {
    label: 'Ajuda extra',
    topics: [
      {
        id: 'faq',
        icon: '❓',
        label: 'Dúvidas frequentes',
        intro: 'Situações comuns e o que fazer.',
        sections: [
          {
            titulo: 'Perguntas e respostas',
            passos: [
              '<strong>Os preços da Busca pararam de atualizar.</strong> Veja o recado "Bot do WhatsApp sem sinal" no Dashboard. O bot roda no computador da loja: se ele ficar sem internet ou desligado, as listas e os recibos param.',
              '<strong>O recibo ficou "Na fila de envio" e não chegou.</strong> A fila é processada pelo bot. Com o bot sem sinal o recibo espera; quando o sinal volta ele é enviado. Se der erro, o botão de envio é liberado para tentar de novo.',
              '<strong>Cliquei em "Feito" no pós-venda sem querer.</strong> Dashboard → Pós-venda concluídos → <strong>Reabrir</strong>.',
              '<strong>O recibo não mostra o serial do aparelho.</strong> Preencha "Dados do aparelho" na Compra ou "Observações" no Pedido — o recibo mostra os dois.',
              '<strong>Um botão não aparece para mim.</strong> Falta permissão: peça ao master para liberar no módulo correspondente (Usuários).',
              '<strong>Quero esconder os valores da tela.</strong> Botão do olho 👁️ na barra do topo.',
              '<strong>A tela ficou escura / clara demais.</strong> Botão de tema na barra do topo (☀️/🌙).',
              '<strong>Os números do DRE não batem com Vendas.</strong> O DRE é por caixa (quando pagou/recebeu); Vendas é por data da venda. Veja o aviso no tópico Relatórios.',
            ],
          },
        ],
        avisos: [
          '<strong>Exclusões são definitivas:</strong> pedido, venda, compra e lançamentos financeiros apagados não podem ser recuperados pelo sistema. Na dúvida, não exclua — cancele ou desative.',
        ],
      },
    ],
  },
]
