import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createPedido, updatePedido } from './service.js'
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

  // ── Estado reativo ─────────────────────────────────────────────────────────
  let produtos = (pedido?.produtos || [{ nome: '', acessorios: [] }]).map(p => ({
    nome:       p.nome       || '',
    acessorios: [...(p.acessorios || [])],
  }))
  if (!produtos.length) produtos = [{ nome: '', acessorios: [] }]

  let formaPagamento = pedido?.formaPagamento || ''
  let trocaAtiva     = !!pedido?.troca

  // ── Datalists ──────────────────────────────────────────────────────────────
  const clientesDatalistId = 'pf2-clientes'
  const produtosDatalistId = 'pf2-produtos'
  const fornDatalistId     = 'pf2-forn'

  const clientesDatalist = el('datalist', { id: clientesDatalistId })
  clientes.forEach(c => clientesDatalist.appendChild(el('option', { value: c.name })))

  const produtosDatalist = el('datalist', { id: produtosDatalistId })
  produtosCatalogo.forEach(p => produtosDatalist.appendChild(el('option', { value: p.nome })))

  const fornDatalist = el('datalist', { id: fornDatalistId })
  fornecedores.forEach(f => fornDatalist.appendChild(el('option', { value: f.name })))

  // ── Identificação ──────────────────────────────────────────────────────────
  const dataInp = el('input', { type: 'date' })
  dataInp.value = pedido?.dataContato || todayISO()

  const clienteInp = el('input', { type: 'text', list: clientesDatalistId, placeholder: 'Nome do cliente' })
  clienteInp.value = pedido?.cliente || pedido?.clienteNome || ''

  // ── Produtos ───────────────────────────────────────────────────────────────
  const produtosWrap = el('div', { class: 'produtos-wrap' })

  function renderProdutos() {
    produtosWrap.replaceChildren()
    produtos.forEach((p, i) => {

      // Acessórios deste produto
      const acessListEl = el('div', { class: 'acessorios-selected' })

      function renderAcessProduto() {
        acessListEl.replaceChildren()
        produtos[i].acessorios.forEach((a, j) => {
          const rm = el('button', { type: 'button', class: 'acessorio-remove-btn' }, '×')
          rm.addEventListener('click', () => {
            produtos[i].acessorios.splice(j, 1)
            renderAcessProduto()
          })
          acessListEl.appendChild(el('span', { class: 'acessorio-item' }, a, rm))
        })
      }

      function addAcessProduto(nome) {
        const n = nome.trim()
        if (!n || produtos[i].acessorios.includes(n)) return
        produtos[i].acessorios.push(n)
        renderAcessProduto()
      }

      renderAcessProduto()

      const quickBtns = ACESSORIOS_RAPIDOS.map(a => {
        const btn = el('button', { type: 'button', class: 'acessorio-quick-btn' }, a)
        btn.addEventListener('click', () => addAcessProduto(a))
        return btn
      })

      const acessInp = el('input', { type: 'text', class: 'acessorio-custom-inp',
        placeholder: 'ex: Película 3D, Fonte Tipo C...' })
      acessInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addAcessProduto(acessInp.value); acessInp.value = '' }
      })
      const acessAddBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, '+ Add')
      acessAddBtn.addEventListener('click', () => { addAcessProduto(acessInp.value); acessInp.value = '' })

      const nomeInp = el('input', { type: 'text', list: produtosDatalistId, placeholder: 'ex: iPhone 17 Pro Max 256GB' })
      nomeInp.value = p.nome || ''
      nomeInp.addEventListener('input', () => { produtos[i].nome = nomeInp.value })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => {
        if (produtos.length === 1) return
        produtos.splice(i, 1); renderProdutos()
      })

      produtosWrap.appendChild(
        el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, `Produto ${i + 1}`),
            delBtn
          ),
          el('div', { class: 'field' }, el('label', {}, 'Item'), nomeInp),
          el('div', { class: 'form-section-sub' },
            el('p', { class: 'form-sub-label' }, 'Acessórios'),
            el('div', { class: 'acessorios-quickadd' }, ...quickBtns),
            el('div', { class: 'acessorio-custom-row' }, acessInp, acessAddBtn),
            acessListEl
          )
        )
      )
    })
  }

  renderProdutos()

  const addProdutoBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ produto')
  addProdutoBtn.addEventListener('click', () => {
    produtos.push({ nome: '', acessorios: [] })
    renderProdutos()
  })

  // ── Financeiro ─────────────────────────────────────────────────────────────
  const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
  valorInp.value = pedido?.valorNegociado || ''

  // Chips de pagamento
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

  // ── Troca ──────────────────────────────────────────────────────────────────
  const trocaProdutoInp  = el('input', { type: 'text', placeholder: 'Produto recebido na troca' })
  const trocaCreditoInp  = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
  trocaProdutoInp.value  = pedido?.troca?.produto      || ''
  trocaCreditoInp.value  = pedido?.troca?.valorCredito || ''

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

  // ── Observações ────────────────────────────────────────────────────────────
  const obsInp = el('textarea', { rows: '2', class: 'field-textarea', placeholder: 'Observações, serial, modelo...' })
  obsInp.value = pedido?.observacoes || ''

  // ── Botões ─────────────────────────────────────────────────────────────────
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
      const data = {
        dataContato:    dataInp.value,
        cliente,
        produtos,
        valorNegociado: valorInp.value,
        formaPagamento,
        troca,
        observacoes:    obsInp.value,
      }
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

  // ── Layout ─────────────────────────────────────────────────────────────────
  container.append(
    clientesDatalist, produtosDatalist, fornDatalist,
    el('div', { class: 'pedido-form' },
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Identificação'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', {}, 'Data do contato'), dataInp),
          el('div', { class: 'field field-full' }, el('label', {}, 'Cliente'), clienteInp),
        )
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'form-produto-header' },
          el('p', { class: 'form-section-title', style: 'margin:0' }, 'Produtos'),
          addProdutoBtn
        ),
        produtosWrap
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Negociação'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' },
            el('label', {}, 'Valor negociado R$'), valorInp
          ),
          el('div', { class: 'field field-full' },
            el('label', {}, 'Forma de pagamento'),
            makePagChips()
          ),
        ),
        el('div', { class: 'troca-row' }, trocaToggle),
        trocaSection,
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'field' },
          el('label', {}, 'Observações'), obsInp
        )
      )
    ),
    el('div', { class: 'modal-footer' }, cancelBtn, submitBtn)
  )
}
