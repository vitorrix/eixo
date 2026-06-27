import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createPedido, updatePedido } from './service.js'
import { createClienteRapido } from '../clientes/service.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

const PAGAMENTO_OPTS = [
  { value: 'pix',      label: '🏦 PIX'      },
  { value: 'dinheiro', label: '💰 Dinheiro'  },
  { value: 'cartao',   label: '💳 Cartão'   },
  { value: 'link',     label: '🏪 Link'     },
]

const ACESSORIOS_RAPIDOS = ['Case', 'Película', 'Fonte', 'Cabo', 'AirPods', 'Baseus', 'Peining']

function todayISO() { return new Date().toISOString().slice(0, 10) }

export function renderPedidoForm(container, close, pedido, { clientes, produtosCatalogo, fornecedores }) {
  const isEdit = !!pedido

  // ── Estado ────────────────────────────────────────────────────────────────
  let produtos = (pedido?.produtos || [{ nome: '', cor: '', valor: '', acessorios: [] }]).map(p => ({
    nome:       p.nome       || '',
    cor:        p.cor        || '',
    valor:      p.valor      !== undefined ? p.valor : '',
    acessorios: [...(p.acessorios || [])],
  }))
  if (!produtos.length) produtos = [{ nome: '', cor: '', valor: '', acessorios: [] }]

  let formaPagamento = pedido?.formaPagamento || ''
  let trocaAtiva     = !!pedido?.troca

  // ── Datalists ─────────────────────────────────────────────────────────────
  const clientesDatalistId = 'pf2-clientes'
  const produtosDatalistId = 'pf2-produtos'
  const fornDatalistId     = 'pf2-forn'

  let clientesList = [...clientes]

  const clientesDatalist = el('datalist', { id: clientesDatalistId })
  function refreshClientesDatalist() {
    clientesDatalist.replaceChildren()
    clientesList.forEach(c => clientesDatalist.appendChild(el('option', { value: c.name })))
  }
  refreshClientesDatalist()

  const produtosDatalist = el('datalist', { id: produtosDatalistId })
  produtosCatalogo.forEach(p => produtosDatalist.appendChild(el('option', { value: p.nome })))

  const fornDatalist = el('datalist', { id: fornDatalistId })
  fornecedores.forEach(f => fornDatalist.appendChild(el('option', { value: f.name })))

  // ── Identificação ─────────────────────────────────────────────────────────
  const dataInp = el('input', { type: 'date' })
  dataInp.value = pedido?.dataContato || todayISO()

  const clienteInp = el('input', { type: 'text', list: clientesDatalistId, placeholder: 'Nome do cliente' })
  clienteInp.value = pedido?.cliente || pedido?.clienteNome || ''

  // ── Hint cadastro rápido ───────────────────────────────────────────────────
  const cadastrarHint = el('div', { class: 'cliente-cadastrar-hint hidden' })

  function isClienteExistente(nome) {
    return clientesList.some(c => c.name.toLowerCase() === nome.toLowerCase())
  }

  function updateCadastrarHint() {
    const nome = clienteInp.value.trim()
    if (!nome || isClienteExistente(nome)) { cadastrarHint.classList.add('hidden'); return }
    cadastrarHint.replaceChildren()
    const btn = el('button', { type: 'button', class: 'btn-cadastrar-rapido' },
      `+ Cadastrar "${nome}" como novo cliente`)
    btn.addEventListener('click', () => abrirCadastroRapido(nome))
    cadastrarHint.appendChild(btn)
    cadastrarHint.classList.remove('hidden')
  }

  clienteInp.addEventListener('input', updateCadastrarHint)

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

        const nomeRapidoInp = el('input', { type: 'text', placeholder: 'Nome completo' })
        nomeRapidoInp.value = nomeInicial
        const telefoneInp = el('input', { type: 'tel', placeholder: '(00) 00000-0000' })
        const cancelarBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelarBtn.addEventListener('click', closeModal)
        const salvarBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Cadastrar')
        salvarBtn.addEventListener('click', async () => {
          const nome = nomeRapidoInp.value.trim()
          if (!nome) { toastError('Informe o nome do cliente.'); return }
          salvarBtn.disabled = true; salvarBtn.textContent = 'Salvando...'
          try {
            const docRef = await createClienteRapido(nome, telefoneInp.value, tipo)
            clientesList.push({ id: docRef.id, name: nome, nameLower: nome.toLowerCase() })
            clientesList.sort((a, b) => a.nameLower.localeCompare(b.nameLower))
            refreshClientesDatalist()
            clienteInp.value = nome
            updateCadastrarHint()
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
          el('div', { class: 'field', style: 'margin-bottom:12px' }, el('label', {}, 'Nome'), nomeRapidoInp),
          el('div', { class: 'field', style: 'margin-bottom:20px' }, el('label', {}, 'Telefone'), telefoneInp),
          el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, cancelarBtn, salvarBtn)
        )
        setTimeout(() => nomeRapidoInp.focus(), 50)
      },
    })
  }

  // ── Produtos ──────────────────────────────────────────────────────────────
  const produtosWrap  = el('div', { class: 'produtos-wrap' })
  const totalDisplay  = el('div', { class: 'pedido-total-display' })

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
        produtos[i].acessorios.push(n)
        renderAcess()
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

      const nomeInp = el('input', { type: 'text', list: produtosDatalistId, placeholder: 'ex: iPhone 17 Pro Max 256GB' })
      nomeInp.value = p.nome || ''
      nomeInp.addEventListener('input', () => { produtos[i].nome = nomeInp.value })

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
            el('div', { class: 'field' }, el('label', {}, 'Item'), nomeInp),
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
    produtos.push({ nome: '', cor: '', valor: '', acessorios: [] })
    renderProdutos()
  })

  // ── Negociação ────────────────────────────────────────────────────────────
  function makePagChips() {
    const wrap = el('div', { class: 'status-chips-row' })
    const btns = PAGAMENTO_OPTS.map(opt => {
      const btn = el('button', { type: 'button', class: 'status-chip-btn' }, opt.label)
      if (formaPagamento === opt.value) btn.classList.add('active')
      btn.addEventListener('click', () => {
        formaPagamento = formaPagamento === opt.value ? '' : opt.value
        btns.forEach((b, j) => b.classList.toggle('active', formaPagamento === PAGAMENTO_OPTS[j].value))
      })
      return btn
    })
    btns.forEach(b => wrap.appendChild(b))
    return wrap
  }

  // ── Troca ─────────────────────────────────────────────────────────────────
  const trocaProdutoInp = el('input', { type: 'text', placeholder: 'Produto recebido na troca' })
  const trocaCreditoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
  trocaProdutoInp.value = pedido?.troca?.produto      || ''
  trocaCreditoInp.value = pedido?.troca?.valorCredito || ''

  const trocaSection = el('div', { class: 'troca-section' })
  function renderTroca() {
    trocaSection.replaceChildren()
    if (trocaAtiva) {
      mount(trocaSection,
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', {}, 'Produto da troca'), trocaProdutoInp),
          el('div', { class: 'field' }, el('label', {}, 'Crédito R$'), trocaCreditoInp),
        )
      )
    }
  }

  const trocaToggle = el('button', { type: 'button', class: 'btn btn-outline btn-sm' },
    trocaAtiva ? '↔️ Troca ativa' : '↔️ Inclui troca?')
  trocaToggle.classList.toggle('btn-active-outline', trocaAtiva)
  trocaToggle.addEventListener('click', () => {
    trocaAtiva = !trocaAtiva
    trocaToggle.textContent = trocaAtiva ? '↔️ Troca ativa' : '↔️ Inclui troca?'
    trocaToggle.classList.toggle('btn-active-outline', trocaAtiva)
    renderTroca()
  })
  renderTroca()

  // ── Observações ───────────────────────────────────────────────────────────
  const obsInp = el('textarea', { rows: '2', class: 'field-textarea', placeholder: 'Observações, serial, modelo...' })
  obsInp.value = pedido?.observacoes || ''

  // ── Botões ────────────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  cancelBtn.addEventListener('click', close)

  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' },
    isEdit ? 'Salvar alterações' : 'Criar pedido')

  submitBtn.addEventListener('click', async () => {
    const cliente = clienteInp.value.trim()
    if (!cliente) { toastError('Informe o nome do cliente.'); return }
    if (!dataInp.value) { toastError('Informe a data.'); return }

    const troca = trocaAtiva
      ? { produto: trocaProdutoInp.value.trim(), valorCredito: parseFloat(trocaCreditoInp.value) || 0 }
      : null

    submitBtn.disabled = true
    submitBtn.textContent = 'Salvando...'

    try {
      const data = { dataContato: dataInp.value, cliente, produtos, formaPagamento, troca, observacoes: obsInp.value }
      if (isEdit) {
        await updatePedido(pedido.id, data)
        toastSuccess('Pedido atualizado.')
      } else {
        await createPedido(data)
        toastSuccess('Pedido criado.')
      }
      close()
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar pedido.')
      submitBtn.disabled = false
      submitBtn.textContent = isEdit ? 'Salvar alterações' : 'Criar pedido'
    }
  })

  // ── Layout ────────────────────────────────────────────────────────────────
  container.append(
    clientesDatalist, produtosDatalist, fornDatalist,
    el('div', { class: 'pedido-form' },
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Identificação'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', {}, 'Data do contato'), dataInp),
          el('div', { class: 'field field-full' }, el('label', {}, 'Cliente'), clienteInp, cadastrarHint),
        )
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'form-produto-header' },
          el('p', { class: 'form-section-title', style: 'margin:0' }, 'Produtos'),
          addProdutoBtn
        ),
        produtosWrap,
        totalDisplay
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Negociação'),
        el('div', { class: 'field' }, el('label', {}, 'Forma de pagamento'), makePagChips()),
        el('div', { class: 'troca-row', style: 'margin-top:12px' }, trocaToggle),
        trocaSection,
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'field' }, el('label', {}, 'Observações'), obsInp)
      )
    ),
    el('div', { class: 'modal-footer' }, cancelBtn, submitBtn)
  )
}
