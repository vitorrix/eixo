import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createPedido, updatePedido } from './service.js'
import { createClienteRapido } from '../clientes/service.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
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

export function renderPedidoForm(container, close, pedido, { clientes, produtosCatalogo }) {
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

  const produtoNomes  = produtosCatalogo.map(p => p.nome)
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
  clienteAc.el.style.width = '100%'

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
  const trocaAc = createAutocomplete({
    placeholder:  'ex: iPhone 16 Pro 128GB S/N',
    items:        produtoNomes,
    initialValue: pedido?.troca?.produto || '',
  })
  trocaAc.el.style.width = '100%'

  const trocaCreditoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
  trocaCreditoInp.value = pedido?.troca?.valorCredito || ''

  const trocaSection = el('div', { class: 'troca-section' })
  function renderTroca() {
    trocaSection.replaceChildren()
    if (trocaAtiva) {
      mount(trocaSection,
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', {}, 'Produto da troca'), trocaAc.el),
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
  const obsInp = el('textarea', { rows: '2', class: 'field-textarea',
    placeholder: 'Observações, serial, modelo...' })
  obsInp.value = pedido?.observacoes || ''

  // ── Botões ────────────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  cancelBtn.addEventListener('click', close)

  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' },
    isEdit ? 'Salvar alterações' : 'Criar pedido')

  submitBtn.addEventListener('click', async () => {
    const cliente = clienteAc.getValue().trim()
    if (!cliente) { toastError('Informe o nome do cliente.'); return }
    if (!dataInp.value) { toastError('Informe a data.'); return }

    const troca = trocaAtiva
      ? { produto: trocaAc.getValue().trim(), valorCredito: parseFloat(trocaCreditoInp.value) || 0 }
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
    el('div', { class: 'pedido-form' },
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Identificação'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', {}, 'Data do contato'), dataInp),
          el('div', { class: 'field field-full' }, el('label', {}, 'Cliente'), clienteAc.el),
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
