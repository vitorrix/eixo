import { el, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createPedido, updatePedido } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

const STATUS_OPTIONS = [
  { value: 'aguardando', label: 'Aguardando Pgto' },
  { value: 'pago',       label: 'Pago' },
  { value: 'logistica',  label: 'Em Logística' },
  { value: 'entregue',   label: 'Entregue' },
  { value: 'pos_venda',  label: 'Pós-venda' },
]

const LOGISTICA_OPTIONS = [
  { value: '',         label: '— Logística —' },
  { value: 'motoboy',  label: 'Motoboy' },
  { value: 'correio',  label: 'Correios' },
  { value: 'retirada', label: 'Retirada' },
]

const ACESSORIOS = ['Case', 'Película', 'Fonte', 'Cabo', 'AirPods']

function todayISO() { return new Date().toISOString().slice(0, 10) }

export function renderPedidoForm(container, close, pedido, { clientes, fornecedores, formasPagamento }) {
  const isEdit = !!pedido

  // ── Totais (declarados antes das funções que os referenciam) ─────────────
  const custoTotalEl  = el('span', { class: 'total-value' })
  const vendaTotalEl  = el('span', { class: 'total-value' })
  const margemTotalEl = el('span', { class: 'total-value total-margem' })

  function recalcTotals() {
    const c = produtos.reduce((s, p) => s + (p.custo || 0), 0)
    const v = produtos.reduce((s, p) => s + (p.venda || 0), 0)
    const m = v - c
    custoTotalEl.textContent  = brl(c)
    vendaTotalEl.textContent  = brl(v)
    margemTotalEl.textContent = (m >= 0 ? '+' : '') + brl(m)
    margemTotalEl.className   = 'total-value total-margem ' + (m >= 0 ? 'green' : 'red')
  }

  // ── Produtos ─────────────────────────────────────────────────────────────
  let produtos = pedido?.produtos?.map(p => ({ ...p }))
    || [{ nome: '', fornecedorId: null, fornecedorNome: '', custo: 0, venda: 0 }]

  const produtosWrap = el('div', { class: 'produtos-wrap' })

  function renderProdutos() {
    produtosWrap.replaceChildren()
    produtos.forEach((p, i) => {
      const lucroEl = el('div', { class: 'lucro-display' })

      function updateLucro() {
        const l = (produtos[i].venda || 0) - (produtos[i].custo || 0)
        lucroEl.textContent = (l >= 0 ? '+' : '') + brl(l)
        lucroEl.className   = 'lucro-display ' + (l >= 0 ? 'green' : 'red')
      }

      const nomeInp = el('input', { type: 'text', placeholder: 'ex: iPhone 17 Pro Max 256GB' })
      nomeInp.value = p.nome || ''
      nomeInp.addEventListener('input', () => { produtos[i].nome = nomeInp.value })

      const fornSel = el('select', { class: 'field-select' })
      fornSel.appendChild(el('option', { value: '' }, '— Fornecedor —'))
      fornecedores.forEach(f => fornSel.appendChild(el('option', { value: f.id }, f.name)))
      if (p.fornecedorId) fornSel.value = p.fornecedorId
      fornSel.addEventListener('change', () => {
        const found = fornecedores.find(f => f.id === fornSel.value)
        produtos[i].fornecedorId   = fornSel.value || null
        produtos[i].fornecedorNome = found?.name || ''
      })

      const custoInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
      custoInp.value = p.custo || ''
      custoInp.addEventListener('input', () => {
        produtos[i].custo = parseFloat(custoInp.value) || 0
        updateLucro(); recalcTotals()
      })

      const vendaInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
      vendaInp.value = p.venda || ''
      vendaInp.addEventListener('input', () => {
        produtos[i].venda = parseFloat(vendaInp.value) || 0
        updateLucro(); recalcTotals()
      })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => {
        if (produtos.length === 1) return
        produtos.splice(i, 1); renderProdutos(); recalcTotals()
      })

      updateLucro()

      produtosWrap.appendChild(
        el('div', { class: 'form-produto-block' },
          el('div', { class: 'form-produto-header' },
            el('span', { class: 'form-produto-label' }, `Produto ${i + 1}`),
            delBtn
          ),
          el('div', { class: 'field field-full' },
            el('label', {}, 'Nome do produto'), nomeInp
          ),
          el('div', { class: 'form-produto-row' },
            el('div', { class: 'field' }, el('label', {}, 'Fornecedor'), fornSel),
            el('div', { class: 'field field-num' }, el('label', {}, 'Custo R$'), custoInp),
            el('div', { class: 'field field-num' }, el('label', {}, 'Venda R$'), vendaInp),
            el('div', { class: 'field' }, el('label', {}, 'Lucro'), lucroEl),
          )
        )
      )
    })
  }

  renderProdutos()
  recalcTotals()

  const addProdutoBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ produto')
  addProdutoBtn.addEventListener('click', () => {
    produtos.push({ nome: '', fornecedorId: null, fornecedorNome: '', custo: 0, venda: 0 })
    renderProdutos()
  })

  // ── Identificação ────────────────────────────────────────────────────────
  const dataInp = el('input', { type: 'date', id: 'pf-data' })
  dataInp.value = pedido?.data || todayISO()

  const clienteSel = el('select', { id: 'pf-cliente', class: 'field-select' })
  clienteSel.appendChild(el('option', { value: '' }, '— Selecionar cliente —'))
  clientes.forEach(c => clienteSel.appendChild(el('option', { value: c.id }, c.name)))
  if (pedido?.clienteId) clienteSel.value = pedido.clienteId

  // ── Acessórios ───────────────────────────────────────────────────────────
  let selectedAcessorios = [...(pedido?.acessorios || [])]
  const acessorioBtns = ACESSORIOS.map(a => {
    const btn = el('button', { type: 'button', class: 'acessorio-btn' }, a)
    if (selectedAcessorios.includes(a)) btn.classList.add('active')
    btn.addEventListener('click', () => {
      if (selectedAcessorios.includes(a)) {
        selectedAcessorios = selectedAcessorios.filter(x => x !== a)
        btn.classList.remove('active')
      } else {
        selectedAcessorios.push(a)
        btn.classList.add('active')
      }
    })
    return btn
  })

  // ── Status / Pagamento / Logística ────────────────────────────────────────
  const statusSel = el('select', { id: 'pf-status', class: 'field-select' })
  STATUS_OPTIONS.forEach(s => statusSel.appendChild(el('option', { value: s.value }, s.label)))
  statusSel.value = pedido?.statusEntrega || 'aguardando'

  const pagSel = el('select', { id: 'pf-pag', class: 'field-select' })
  pagSel.appendChild(el('option', { value: '' }, '— Pagamento —'))
  formasPagamento.forEach(f => pagSel.appendChild(el('option', { value: f.nome }, f.nome)))
  if (pedido?.pagamento) pagSel.value = pedido.pagamento

  const logSel = el('select', { id: 'pf-log', class: 'field-select' })
  LOGISTICA_OPTIONS.forEach(o => logSel.appendChild(el('option', { value: o.value }, o.label)))
  if (pedido?.logistica) logSel.value = pedido.logistica

  // ── Checkboxes ────────────────────────────────────────────────────────────
  const sistemaChk = el('input', { type: 'checkbox', id: 'pf-sistema' })
  sistemaChk.checked = !!pedido?.sistemaOk
  const notaChk = el('input', { type: 'checkbox', id: 'pf-nota' })
  notaChk.checked = !!pedido?.notaEnviada
  const trocaChk = el('input', { type: 'checkbox', id: 'pf-troca' })
  trocaChk.checked = !!pedido?.inclui_troca

  // ── Observações ───────────────────────────────────────────────────────────
  const obsInp = el('textarea', { id: 'pf-obs', rows: '3', class: 'field-textarea',
    placeholder: 'Serial, modelo, notas...' })
  obsInp.value = pedido?.observacoes || ''

  // ── Botões ────────────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  cancelBtn.addEventListener('click', close)

  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' },
    isEdit ? 'Salvar alterações' : 'Criar pedido')

  submitBtn.addEventListener('click', async () => {
    const clienteId   = clienteSel.value || null
    const clienteNome = clientes.find(c => c.id === clienteId)?.name || ''

    if (!clienteId) { toastError('Selecione um cliente.'); return }
    if (!dataInp.value) { toastError('Informe a data.'); return }

    submitBtn.disabled = true
    submitBtn.textContent = 'Salvando...'

    try {
      const data = {
        data:          dataInp.value,
        clienteId,
        clienteNome,
        produtos,
        acessorios:    selectedAcessorios,
        pagamento:     pagSel.value,
        logistica:     logSel.value,
        statusEntrega: statusSel.value,
        sistemaOk:     sistemaChk.checked,
        notaEnviada:   notaChk.checked,
        inclui_troca:  trocaChk.checked,
        observacoes:   obsInp.value,
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

  // ── Layout ────────────────────────────────────────────────────────────────
  container.append(
    el('div', { class: 'pedido-form' },
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Identificação'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', { for: 'pf-data' }, 'Data'), dataInp),
          el('div', { class: 'field field-full' }, el('label', { for: 'pf-cliente' }, 'Cliente'), clienteSel),
        )
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'form-produto-header' },
          el('p', { class: 'form-section-title', style: 'margin:0' }, 'Produtos'),
          addProdutoBtn
        ),
        produtosWrap,
        el('div', { class: 'form-totais-row' },
          el('span', { class: 'total-label' }, 'Custo: '), custoTotalEl,
          el('span', { class: 'total-sep' }, '·'),
          el('span', { class: 'total-label' }, 'Venda: '), vendaTotalEl,
          el('span', { class: 'total-sep' }, '·'),
          el('span', { class: 'total-label' }, 'Margem: '), margemTotalEl,
        )
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Acessórios incluídos'),
        el('div', { class: 'acessorios-toggle' }, ...acessorioBtns)
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Status e Pagamento'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', { for: 'pf-status' }, 'Status'), statusSel),
          el('div', { class: 'field' }, el('label', { for: 'pf-pag' }, 'Pagamento'), pagSel),
          el('div', { class: 'field' }, el('label', { for: 'pf-log' }, 'Logística'), logSel),
        ),
        el('div', { class: 'form-check-row' },
          el('label', { class: 'form-check-item', for: 'pf-sistema' }, sistemaChk, ' Sistema OK'),
          el('label', { class: 'form-check-item', for: 'pf-nota' },    notaChk,    ' Nota enviada'),
          el('label', { class: 'form-check-item', for: 'pf-troca' },   trocaChk,   ' Inclui troca'),
        )
      ),
      el('div', { class: 'form-section' },
        el('div', { class: 'field field-full' },
          el('label', { for: 'pf-obs' }, 'Observações (serial, modelo, etc.)'),
          obsInp
        )
      )
    ),
    el('div', { class: 'modal-footer' }, cancelBtn, submitBtn)
  )
}
