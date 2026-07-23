import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createPedido, editarPedido, normalizarTrocasPedido } from './service.js'
import { createClienteRapido } from '../clientes/service.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { createEntityPeek } from '../../shared/components/EntityPeek.js'
import { renderClienteForm } from '../clientes/form.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

const PAGAMENTO_OPTS = [
  { value: 'pix',      label: '🏦 PIX'     },
  { value: 'dinheiro', label: '💰 Dinheiro' },
  { value: 'cartao',   label: '💳 Cartão'  },
]

const ACESSORIOS_RAPIDOS = ['Case', 'Película', 'Fonte', 'Cabo', 'AirPods', 'Baseus', 'Peining']

function todayISO() { return new Date().toISOString().slice(0, 10) }

export function renderPedidoForm(container, close, pedido, { clientes, produtosCatalogo }) {
  const isEdit = !!pedido

  // ── Estado ────────────────────────────────────────────────────────────────
  let produtos = (pedido?.produtos || [{ tipo: 'produto', nome: '', cor: '', valor: '', acessorios: [] }]).map(p => ({
    tipo:       p.tipo === 'manutencao' ? 'manutencao' : 'produto',
    nome:       p.nome       || '',
    cor:        p.cor        || '',
    aparelho:   p.aparelho   || '',
    valor:      p.valor      !== undefined ? p.valor : '',
    acessorios: [...(p.acessorios || [])],
  }))
  if (!produtos.length) produtos = [{ tipo: 'produto', nome: '', cor: '', valor: '', acessorios: [] }]

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

  function calcTotal() {
    return produtos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0)
  }
  function updateTotal() {
    const t = calcTotal()
    totalDisplay.textContent = t > 0 ? `Total: ${brl(t)}` : ''
  }

  function renderProdutos() {
    produtosWrap.replaceChildren()

    produtos.forEach((p, i) => {
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

        const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
        delBtn.addEventListener('click', () => {
          if (produtos.length === 1) return
          produtos.splice(i, 1); renderProdutos(); updateTotal()
        })

        produtosWrap.appendChild(
          el('div', { class: 'form-produto-block manutencao' },
            el('div', { class: 'form-produto-header' },
              el('span', { class: 'form-produto-label' }, `🛠️ Manutenção ${i + 1}`),
              delBtn
            ),
            el('div', { class: 'form-produto-row3' },
              el('div', { class: 'field' }, el('label', {}, 'Aparelho'), aparelhoAc.el),
              el('div', { class: 'field' }, el('label', {}, 'Serviço'), servicoAc.el),
              el('div', { class: 'field field-valor' }, el('label', {}, 'Valor R$'), valorInp),
            )
          )
        )
        return
      }

      const acessListEl = el('div', { class: 'acessorios-selected' })

      function renderAcess() {
        acessListEl.replaceChildren()
        produtos[i].acessorios.forEach((a, j) => {
          const rm = el('button', { type: 'button', class: 'acessorio-remove-btn' }, '×')
          rm.addEventListener('click', () => { produtos[i].acessorios.splice(j, 1); renderAcess() })
          acessListEl.appendChild(el('span', { class: 'acessorio-item' }, a, rm))
        })
      }
      function addAcess(nome) {
        const n = nome.trim()
        if (!n || produtos[i].acessorios.includes(n)) return
        produtos[i].acessorios.push(n); renderAcess()
      }
      renderAcess()

      const quickBtns = ACESSORIOS_RAPIDOS.map(a => {
        const btn = el('button', { type: 'button', class: 'acessorio-quick-btn' }, a)
        btn.addEventListener('click', () => addAcess(a))
        return btn
      })
      const acessInp = el('input', { type: 'text', class: 'acessorio-custom-inp',
        placeholder: 'ex: Película 3D, Fonte Tipo C...' })
      acessInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addAcess(acessInp.value); acessInp.value = '' }
      })
      const acessAddBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, '+ Add')
      acessAddBtn.addEventListener('click', () => { addAcess(acessInp.value); acessInp.value = '' })

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

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => {
        if (produtos.length === 1) return
        produtos.splice(i, 1); renderProdutos(); updateTotal()
      })

      produtosWrap.appendChild(
        el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, `Produto ${i + 1}`),
            delBtn
          ),
          el('div', { class: 'form-produto-row3' },
            el('div', { class: 'field' }, el('label', {}, 'Item'), nomeAc.el),
            el('div', { class: 'field field-cor' }, el('label', {}, 'Cor'), corInp),
            el('div', { class: 'field field-valor' }, el('label', {}, 'Valor R$'), valorInp),
          ),
          el('div', { class: 'form-section-sub' },
            el('p', { class: 'form-sub-label' }, 'Acessórios'),
            el('div', { class: 'acessorios-quickadd' }, ...quickBtns),
            el('div', { class: 'acessorio-custom-row' }, acessInp, acessAddBtn),
            acessListEl
          )
        )
      )
    })

    updateTotal()
  }

  renderProdutos()

  const addProdutoBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ produto')
  addProdutoBtn.addEventListener('click', () => {
    produtos.push({ tipo: 'produto', nome: '', cor: '', valor: '', acessorios: [] })
    renderProdutos()
  })

  const addManutencaoBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ manutenção')
  addManutencaoBtn.addEventListener('click', () => {
    produtos.push({ tipo: 'manutencao', nome: '', aparelho: '', valor: '', acessorios: [] })
    renderProdutos()
  })

  // ── Negociação ────────────────────────────────────────────────────────────
  function makePagChips() {
    const wrap = el('div', { class: 'status-chips-row' })
    PAGAMENTO_OPTS.forEach(opt => {
      const btn = el('button', { type: 'button', class: 'status-chip-btn' }, opt.label)
      if (formasPagamento.includes(opt.value)) btn.classList.add('active')
      btn.addEventListener('click', () => {
        const idx = formasPagamento.indexOf(opt.value)
        if (idx === -1) formasPagamento.push(opt.value)
        else formasPagamento.splice(idx, 1)
        btn.classList.toggle('active', formasPagamento.includes(opt.value))
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
      const data = { dataContato: dataInp.value, cliente, produtos, formasPagamento, trocas: trocasFinal, observacoes: obsInp.value }
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
        el('div', { class: 'form-produto-header' },
          el('p', { class: 'form-section-title', style: 'margin:0' }, 'Produtos'),
          el('div', { style: 'display:flex;gap:8px' }, addManutencaoBtn, addProdutoBtn)
        ),
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
