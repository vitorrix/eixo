import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createPedido, editarPedido, normalizarTrocasPedido } from './service.js'
import { createClienteRapido } from '../clientes/service.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { createEntityPeek } from '../../shared/components/EntityPeek.js'
import { renderClienteForm } from '../clientes/form.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

function todayISO() { return new Date().toISOString().slice(0, 10) }

export function renderPedidoForm(container, close, pedido, { clientes, produtosCatalogo, operacoes = {} }) {
  const formasPagamentoConfig = operacoes.formasPagamento || []
  const isEdit = !!pedido

  const produtosAcessorios = produtosCatalogo.filter(p => {
    const cat = (p.categoria || '').trim().toLowerCase()
    return cat === 'acessórios' || cat === 'acessorios'
  })
  const nomesAcessorios = produtosAcessorios.map(p => p.nome)
  function acessorioCatalogo(nome) {
    return produtosAcessorios.find(p => p.nome === nome) || null
  }

  // ── Estado ────────────────────────────────────────────────────────────────
  // Acessório é item de primeira classe (linha própria, com preço/quantidade/
  // desconto), não mais aninhado dentro de um aparelho. Pedido criado antes
  // dessa mudança ainda tem "acessorios: string[]" dentro de cada produto —
  // ao abrir pra editar, isso "acha" pra linhas de acessório soltas (preço 0,
  // como já era o comportamento — era sempre brinde antes), e ao salvar de
  // novo o pedido já grava no formato novo.
  let produtos = []
  ;(pedido?.produtos || []).forEach(p => {
    produtos.push({
      tipo:        p.tipo === 'manutencao' || p.tipo === 'acessorio' ? p.tipo : 'produto',
      nome:        p.nome       || '',
      cor:         p.cor        || '',
      aparelho:    p.aparelho   || '',
      produtoId:   p.produtoId  || null,
      valor:       p.valor      !== undefined ? p.valor : '',
      quantidade:  p.quantidade || 1,
      desconto:    p.desconto   || 0,
    })
    ;(p.acessorios || []).forEach(nome => {
      produtos.push({
        tipo: 'acessorio', nome, produtoId: acessorioCatalogo(nome)?.id || null,
        valor: 0, quantidade: 1, desconto: 0,
      })
    })
  })
  // Sempre termina com uma linha vazia (tipo não escolhido) pronta pra
  // adicionar o próximo item — é ela que dá lugar aos campos certos assim que
  // o tipo é selecionado, e é reposta sempre que a última linha é preenchida.
  produtos.push({ tipo: '' })

  let formasPagamento = Array.isArray(pedido?.formasPagamento)
    ? [...pedido.formasPagamento]
    : (pedido?.formaPagamento ? [pedido.formaPagamento] : [])
  let trocaAtiva = normalizarTrocasPedido(pedido || {}).length > 0

  const produtoNomes     = produtosCatalogo.map(p => p.nome)
  const produtoNomesSN   = produtosCatalogo.map(p => p.nome).filter(n => n.trim().toUpperCase().endsWith('S/N'))
  // Aparelho da manutenção: só identifica o modelo que está entrando, sem capacidade (GB/TB) —
  // "iPhone 16 128GB/256GB/512GB" viram só "iPhone 16", sem os seminovos (S/N)
  function semCapacidade(nome) {
    return nome.replace(/\s*\d+\s*(GB|TB)\b/gi, '').replace(/\s{2,}/g, ' ').trim()
  }
  const produtoNomesAparelho = [...new Set(
    produtoNomes
      .filter(n => !n.trim().toUpperCase().endsWith('S/N'))
      .map(semCapacidade)
  )]
  // Serviços de manutenção: produtos cadastrados com categoria "Manutenção"
  const produtoNomesManutencao = produtosCatalogo
    .filter(p => (p.categoria || '').trim().toLowerCase() === 'manutenção' || (p.categoria || '').trim().toLowerCase() === 'manutencao')
    .map(p => p.nome)
  let clientesList    = [...clientes]

  // ── Cliente com autocomplete + cadastro rápido ────────────────────────────
  function abrirCadastroRapido(nomeInicial) {
    openModal({
      title: 'Novo cliente',
      size: 'sm',
      renderBody: (body, closeModal) => {
        let tipo = 'PF'
        const pfBtn = el('button', { type: 'button', class: 'type-btn active' }, 'PF')
        const pjBtn = el('button', { type: 'button', class: 'type-btn' }, 'PJ')
        pfBtn.addEventListener('click', () => { tipo = 'PF'; pfBtn.classList.add('active'); pjBtn.classList.remove('active') })
        pjBtn.addEventListener('click', () => { tipo = 'PJ'; pjBtn.classList.add('active'); pfBtn.classList.remove('active') })

        const nomeInp = el('input', { type: 'text', placeholder: 'Nome completo' })
        nomeInp.value = nomeInicial
        const foneInp    = el('input', { type: 'tel', placeholder: '(00) 00000-0000' })
        const cancelarBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelarBtn.addEventListener('click', closeModal)

        const salvarBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Cadastrar')
        salvarBtn.addEventListener('click', async () => {
          const nome = nomeInp.value.trim()
          if (!nome) { toastError('Informe o nome do cliente.'); return }
          salvarBtn.disabled = true; salvarBtn.textContent = 'Salvando...'
          try {
            const docRef = await createClienteRapido(nome, foneInp.value, tipo)
            clientesList.push({ id: docRef.id, name: nome, nameLower: nome.toLowerCase() })
            clientesList.sort((a, b) => a.nameLower.localeCompare(b.nameLower))
            clienteAc.setItems(clientesList.map(c => c.name))
            clienteAc.setValue(nome)
            toastSuccess(`"${nome}" cadastrado.`)
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao cadastrar cliente.')
            salvarBtn.disabled = false; salvarBtn.textContent = 'Cadastrar'
          }
        })

        body.append(
          el('div', { class: 'type-toggle', style: 'margin-bottom:16px' }, pfBtn, pjBtn),
          el('div', { class: 'field', style: 'margin-bottom:12px' }, el('label', {}, 'Nome'), nomeInp),
          el('div', { class: 'field', style: 'margin-bottom:20px' }, el('label', {}, 'Telefone'), foneInp),
          el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, cancelarBtn, salvarBtn)
        )
        setTimeout(() => nomeInp.focus(), 50)
      },
    })
  }

  const clienteAc = createAutocomplete({
    placeholder:  'Nome do cliente',
    items:        clientesList.map(c => c.name),
    initialValue: pedido?.cliente || pedido?.clienteNome || '',
    extraOption: {
      getLabel: q => `+ Cadastrar "${q}" como novo cliente`,
      action:   q => abrirCadastroRapido(q),
    },
  })

  const clientePeek = createEntityPeek({
    getEntity: () => clientesList.find(c => c.name === clienteAc.getValue()),
    onEdit: entity => openModal({
      title: 'Editar Cliente',
      size:  'lg',
      renderBody: (body, close) => renderClienteForm(body, close, entity),
    }),
  })

  // ── Identificação ─────────────────────────────────────────────────────────
  const dataInp = el('input', { type: 'date' })
  dataInp.value = pedido?.dataContato || todayISO()

  // ── Produtos ──────────────────────────────────────────────────────────────
  const produtosWrap = el('div', { class: 'produtos-wrap' })
  const totalDisplay = el('div', { class: 'pedido-total-display' })

  // Total da linha = preço unitário × quantidade − desconto (em R$). Total do
  // pedido = soma de todas as linhas, aparelho/manutenção/acessório juntos.
  function itemTotal(p) {
    const preco = parseFloat(p.valor) || 0
    const qtd   = parseInt(p.quantidade) || 1
    const desc  = parseFloat(p.desconto) || 0
    return preco * qtd - desc
  }
  function calcTotal() {
    return produtos.reduce((s, p) => s + itemTotal(p), 0)
  }
  function updateTotal() {
    const t = calcTotal()
    totalDisplay.textContent = t > 0 ? `Total: ${brl(t)}` : ''
  }

  // Linha de Quantidade/Desconto/Total — igual pros 3 tipos de item. valorInp
  // já existe por tipo (aparelho/manutenção/acessório têm o seu); essa função
  // só cria os 3 campos que faltam e devolve a linha pronta.
  function buildQtdDescTotalRow(p, i, valorInp) {
    const qtdInp = el('input', { type: 'number', step: '1', min: '1', placeholder: '1' })
    qtdInp.value = p.quantidade || 1
    const descInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
    descInp.value = p.desconto || 0
    const totalInp = el('input', { type: 'text', readonly: true, class: 'field-total-readonly' })

    function updateRowTotal() {
      produtos[i].quantidade = qtdInp.value
      produtos[i].desconto   = descInp.value
      totalInp.value = brl(itemTotal(produtos[i]))
    }
    qtdInp.addEventListener('input', () => { updateRowTotal(); updateTotal() })
    descInp.addEventListener('input', () => { updateRowTotal(); updateTotal() })
    valorInp.addEventListener('input', updateRowTotal)
    updateRowTotal()

    return el('div', { class: 'form-produto-row3' },
      el('div', { class: 'field' }, el('label', {}, 'Quantidade'), qtdInp),
      el('div', { class: 'field' }, el('label', {}, 'Desconto R$'), descInp),
      el('div', { class: 'field' }, el('label', {}, 'Total'), totalInp),
    )
  }

  // Item novo do tipo escolhido — zera os campos (troca de tipo não aproveita
  // nada do que tinha antes, os campos são outros).
  function criarItemVazio(tipo) {
    if (tipo === 'manutencao') return { tipo, nome: '', aparelho: '', valor: '', quantidade: 1, desconto: 0 }
    if (tipo === 'acessorio')  return { tipo, nome: '', produtoId: null, valor: '', quantidade: 1, desconto: 0 }
    if (tipo === 'produto')    return { tipo, nome: '', cor: '', valor: '', quantidade: 1, desconto: 0 }
    return { tipo: '' }
  }

  // Garante que sempre sobra uma linha vazia no fim pra dar o próximo item —
  // sem isso, depois de escolher o tipo da única linha, não sobraria nenhuma
  // linha pra continuar adicionando.
  function garantirLinhaVazia() {
    if (!produtos.length || produtos[produtos.length - 1].tipo) produtos.push({ tipo: '' })
  }

  function buildTipoField(p, i) {
    const tipoSel = el('select', { class: 'field-select' },
      el('option', { value: '' }, '— Selecione —'),
      el('option', { value: 'produto' }, 'Produto'),
      el('option', { value: 'manutencao' }, 'Manutenção'),
      el('option', { value: 'acessorio' }, 'Acessório'),
    )
    tipoSel.value = p.tipo || ''
    tipoSel.addEventListener('change', () => {
      produtos[i] = criarItemVazio(tipoSel.value)
      garantirLinhaVazia()
      renderProdutos()
    })
    return el('div', { class: 'form-grid' }, el('div', { class: 'field' }, el('label', {}, 'Tipo'), tipoSel))
  }

  function renderProdutos() {
    produtosWrap.replaceChildren()

    produtos.forEach((p, i) => {
      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => {
        produtos.splice(i, 1)
        garantirLinhaVazia()
        renderProdutos(); updateTotal()
      })

      // Linha ainda sem tipo escolhido — só o seletor, mais nada. É sempre a
      // última linha (garantirLinhaVazia mantém isso), pronta pra virar o
      // próximo item assim que o tipo for escolhido.
      if (!p.tipo) {
        produtosWrap.appendChild(
          el('div', { class: 'form-produto-block form-produto-block-vazio' },
            el('div', { class: 'form-produto-header' },
              el('span', { class: 'form-produto-label' }, `Item ${i + 1}`),
            ),
            buildTipoField(p, i)
          )
        )
        return
      }

      if (p.tipo === 'manutencao') {
        const aparelhoAc = createAutocomplete({
          placeholder:  'ex: iPhone 13 Pro Max 256GB',
          items:        produtoNomesAparelho,
          initialValue: p.aparelho,
          onSelect:     v => { produtos[i].aparelho = v },
        })
        aparelhoAc.el.style.width = '100%'
        aparelhoAc.el.addEventListener('input', () => { produtos[i].aparelho = aparelhoAc.getValue() })

        const servicoAc = createAutocomplete({
          placeholder:  'ex: Troca de Tela',
          items:        produtoNomesManutencao,
          initialValue: p.nome,
          onSelect:     v => { produtos[i].nome = v },
        })
        servicoAc.el.style.width = '100%'
        servicoAc.el.addEventListener('input', () => { produtos[i].nome = servicoAc.getValue() })

        const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
        valorInp.value = p.valor !== undefined && p.valor !== '' ? p.valor : ''
        valorInp.addEventListener('input', () => { produtos[i].valor = valorInp.value; updateTotal() })

        produtosWrap.appendChild(
          el('div', { class: 'form-produto-block manutencao' },
            el('div', { class: 'form-produto-header' },
              el('span', { class: 'form-produto-label' }, `🛠️ Manutenção ${i + 1}`),
              delBtn
            ),
            buildTipoField(p, i),
            el('div', { class: 'form-produto-row3' },
              el('div', { class: 'field' }, el('label', {}, 'Aparelho'), aparelhoAc.el),
              el('div', { class: 'field' }, el('label', {}, 'Serviço'), servicoAc.el),
              el('div', { class: 'field field-valor' }, el('label', {}, 'Valor R$'), valorInp),
            ),
            buildQtdDescTotalRow(p, i, valorInp)
          )
        )
        return
      }

      if (p.tipo === 'acessorio') {
        const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
        valorInp.value = p.valor !== undefined && p.valor !== '' ? p.valor : ''
        valorInp.addEventListener('input', () => { produtos[i].valor = valorInp.value; updateTotal() })

        const nomeAc = createAutocomplete({
          placeholder:  'ex: Case Space',
          items:        nomesAcessorios,
          initialValue: p.nome,
          onSelect:     v => {
            produtos[i].nome = v
            const catalogo = acessorioCatalogo(v)
            produtos[i].produtoId = catalogo?.id || null
            if (catalogo) { valorInp.value = catalogo.precoVenda; produtos[i].valor = catalogo.precoVenda; valorInp.dispatchEvent(new Event('input')) }
          },
        })
        nomeAc.el.style.width = '100%'
        nomeAc.el.addEventListener('input', () => {
          produtos[i].nome = nomeAc.getValue()
          produtos[i].produtoId = acessorioCatalogo(nomeAc.getValue())?.id || null
        })

        const brindeBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, '🎁 Brinde')
        brindeBtn.addEventListener('click', () => {
          valorInp.value = 0
          valorInp.dispatchEvent(new Event('input'))
        })

        produtosWrap.appendChild(
          el('div', { class: 'form-produto-block acessorio' },
            el('div', { class: 'form-produto-header' },
              el('span', { class: 'form-produto-label' }, `🎒 Acessório ${i + 1}`),
              el('div', { style: 'display:flex;gap:6px' }, brindeBtn, delBtn)
            ),
            buildTipoField(p, i),
            el('div', { class: 'form-produto-row3' },
              el('div', { class: 'field field-grow' }, el('label', {}, 'Item'), nomeAc.el),
              el('div', { class: 'field field-valor' }, el('label', {}, 'Preço R$'), valorInp),
            ),
            buildQtdDescTotalRow(p, i, valorInp)
          )
        )
        return
      }

      // Autocomplete do item
      const nomeAc = createAutocomplete({
        placeholder:  'ex: iPhone 17 Pro Max 256GB',
        items:        produtoNomes,
        initialValue: p.nome,
        onSelect:     v => { produtos[i].nome = v },
      })
      nomeAc.el.style.width = '100%'
      nomeAc.el.addEventListener('input', () => { produtos[i].nome = nomeAc.getValue() })

      const corInp = el('input', { type: 'text', placeholder: 'ex: Preto, Branco...' })
      corInp.value = p.cor || ''
      corInp.addEventListener('input', () => { produtos[i].cor = corInp.value })

      const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
      valorInp.value = p.valor !== undefined && p.valor !== '' ? p.valor : ''
      valorInp.addEventListener('input', () => { produtos[i].valor = valorInp.value; updateTotal() })

      produtosWrap.appendChild(
        el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, `📦 Produto ${i + 1}`),
            delBtn
          ),
          buildTipoField(p, i),
          el('div', { class: 'form-produto-row3' },
            el('div', { class: 'field' }, el('label', {}, 'Item'), nomeAc.el),
            el('div', { class: 'field field-cor' }, el('label', {}, 'Cor'), corInp),
            el('div', { class: 'field field-valor' }, el('label', {}, 'Valor R$'), valorInp),
          ),
          buildQtdDescTotalRow(p, i, valorInp)
        )
      )
    })

    updateTotal()
  }

  renderProdutos()

  // ── Negociação ────────────────────────────────────────────────────────────
  function makePagChips() {
    const wrap = el('div', { class: 'status-chips-row' })
    if (!formasPagamentoConfig.length) {
      wrap.appendChild(el('p', { class: 'text-muted' }, 'Nenhuma forma de pagamento cadastrada em Configurações.'))
      return wrap
    }
    formasPagamentoConfig.forEach(f => {
      const nome = f.nome
      const btn = el('button', { type: 'button', class: 'status-chip-btn' }, nome)
      if (formasPagamento.includes(nome)) btn.classList.add('active')
      btn.addEventListener('click', () => {
        const idx = formasPagamento.indexOf(nome)
        if (idx === -1) formasPagamento.push(nome)
        else formasPagamento.splice(idx, 1)
        btn.classList.toggle('active', formasPagamento.includes(nome))
      })
      wrap.appendChild(btn)
    })
    return wrap
  }

  // ── Troca ─────────────────────────────────────────────────────────────────
  // Cliente pode dar mais de um aparelho na troca — lista igual à de produtos,
  // com item repetível e botão de remover (cada troca vira uma Compra própria).
  let trocas = normalizarTrocasPedido(pedido || {}).map(t => ({
    produto:      t.produto || '',
    valorCredito: t.valorCredito !== undefined && t.valorCredito !== '' ? t.valorCredito : '',
    observacoes:  t.observacoes || '',
  }))
  if (!trocas.length) trocas = [{ produto: '', valorCredito: '', observacoes: '' }]

  const trocasWrap = el('div', { class: 'trocas-wrap' })

  function renderTrocas() {
    trocasWrap.replaceChildren()

    trocas.forEach((t, i) => {
      const trocaAc = createAutocomplete({
        placeholder:  'ex: iPhone 16 Pro 128GB S/N',
        items:        produtoNomesSN,
        initialValue: t.produto,
        onSelect:     v => { trocas[i].produto = v },
      })
      trocaAc.el.style.width = '100%'
      trocaAc.el.addEventListener('input', () => { trocas[i].produto = trocaAc.getValue() })

      const creditoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
      creditoInp.value = t.valorCredito
      creditoInp.addEventListener('input', () => { trocas[i].valorCredito = creditoInp.value })

      // Vai junto pra Compra gerada do aparelho da troca — é lá que interessa
      // registrar estado do aparelho, serial, marcas de uso etc.
      const obsInpTroca = el('textarea', { rows: '2', class: 'field-textarea',
        placeholder: 'Estado do aparelho, serial, IMEI, marcas de uso...' })
      obsInpTroca.value = t.observacoes
      obsInpTroca.addEventListener('input', () => { trocas[i].observacoes = obsInpTroca.value })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => {
        if (trocas.length === 1) return
        trocas.splice(i, 1); renderTrocas()
      })

      trocasWrap.appendChild(
        el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, `Troca ${i + 1}`),
            delBtn
          ),
          el('div', { class: 'form-grid' },
            el('div', { class: 'field' }, el('label', {}, 'Produto da troca'), trocaAc.el),
            el('div', { class: 'field' }, el('label', {}, 'Crédito R$'), creditoInp),
            el('div', { class: 'field field-full' },
              el('label', {}, 'Observações da troca'),
              obsInpTroca,
              el('span', { class: 'field-hint' }, 'Vai junto para a Compra deste aparelho.')
            ),
          )
        )
      )
    })
  }
  renderTrocas()

  const addTrocaBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar troca')
  addTrocaBtn.addEventListener('click', () => {
    trocas.push({ produto: '', valorCredito: '', observacoes: '' })
    renderTrocas()
  })

  const trocaSection = el('div', { class: 'troca-section' })
  function renderTrocaSection() {
    trocaSection.replaceChildren()
    if (trocaAtiva) mount(trocaSection, trocasWrap, addTrocaBtn)
  }

  const trocaCheckbox = el('input', { type: 'checkbox', class: 'troca-checkbox' })
  trocaCheckbox.checked = trocaAtiva
  trocaCheckbox.addEventListener('change', () => { trocaAtiva = trocaCheckbox.checked; renderTrocaSection() })
  const trocaToggleRow = el('label', { class: 'troca-toggle-row' }, trocaCheckbox,
    el('span', {}, '↔ Inclui troca'))
  renderTrocaSection()

  // ── Observações ───────────────────────────────────────────────────────────
  const obsInp = el('textarea', { rows: '2', class: 'field-textarea',
    placeholder: 'Observações, serial, modelo...' })
  obsInp.value = pedido?.observacoes || ''

  // ── Botões ────────────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  cancelBtn.addEventListener('click', close)

  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar')

  submitBtn.addEventListener('click', async () => {
    const cliente = clienteAc.getValue().trim()
    if (!cliente) { toastError('Informe o nome do cliente.'); return }
    if (!dataInp.value) { toastError('Informe a data.'); return }

    const trocasFinal = trocaAtiva
      ? trocas
          .map(t => ({
            produto:      (t.produto || '').trim(),
            valorCredito: parseFloat(t.valorCredito) || 0,
            observacoes:  (t.observacoes || '').trim(),
          }))
          .filter(t => t.produto)
      : []

    submitBtn.disabled = true
    submitBtn.textContent = 'Salvando...'

    try {
      const produtosFinal = produtos.filter(p => p.tipo)
      const data = { dataContato: dataInp.value, cliente, produtos: produtosFinal, formasPagamento, trocas: trocasFinal, observacoes: obsInp.value }
      if (isEdit) {
        await editarPedido(pedido.id, data)
        const voltou = pedido.status && pedido.status !== 'negociando'
        toastSuccess(voltou ? 'Pedido atualizado. Confirme o pagamento para prosseguir.' : 'Pedido atualizado.')
      } else {
        await createPedido(data)
        toastSuccess('Pedido criado.')
      }
      close()
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar pedido.')
      submitBtn.disabled = false
      submitBtn.textContent = 'Salvar'
    }
  })

  // ── Layout ────────────────────────────────────────────────────────────────
  container.append(
    el('div', { class: 'pedido-form' },
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Identificação'),
        el('div', { class: 'form-row-ident' },
          el('div', { class: 'field' }, el('label', {}, 'Cliente'),
            el('div', { class: 'peek-field-wrap' }, clienteAc.el, clientePeek.el)),
          el('div', { class: 'field field-data' }, el('label', {}, 'Data'), dataInp),
        )
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Produtos'),
        produtosWrap,
        totalDisplay
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Negociação'),
        el('div', { class: 'field' }, el('label', {}, 'Forma de pagamento'), makePagChips()),
        trocaToggleRow,
        trocaSection,
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'field' }, el('label', {}, 'Observações'), obsInp)
      )
    ),
    el('div', { class: 'modal-footer' }, cancelBtn, submitBtn)
  )
}
