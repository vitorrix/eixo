import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { brl } from '../../shared/utils/formatters.js'
import { createProduto, updateProduto } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

export function renderProdutoForm(container, close, produto, categorias) {
  const isEdit = !!produto
  let selectedFile = null

  // ── Imagem ────────────────────────────────────────────────────────────────
  const fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' })
  const imgEl = el('img', { style: 'display:none;width:100%;height:100%;object-fit:cover;border-radius:8px' })
  const imgHint = el('div', { class: 'produto-img-hint' },
    _cameraIcon(),
    el('span', {}, produto?.imageUrl ? 'Trocar imagem' : 'Adicionar imagem')
  )
  if (produto?.imageUrl) {
    imgEl.src = produto.imageUrl
    imgEl.style.display = 'block'
    imgHint.style.display = 'none'
  }
  const imgBox = el('div', { class: 'produto-img-box' }, fileInput, imgEl, imgHint)
  imgBox.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0]
    if (!file) return
    selectedFile = file
    const url = URL.createObjectURL(file)
    imgEl.src = url
    imgEl.style.display = 'block'
    imgHint.style.display = 'none'
  })

  // ── Campos ────────────────────────────────────────────────────────────────
  const nomeInp = el('input', { type: 'text', id: 'pf-nome', placeholder: 'ex: iPhone 17 Pro Max 256GB' })
  nomeInp.value = produto?.nome || ''

  const catInp = el('input', { type: 'text', id: 'pf-cat', list: 'cat-list',
    placeholder: 'ex: Celular, Acessório, Tablet' })
  catInp.value = produto?.categoria || ''
  const catList = el('datalist', { id: 'cat-list' })
  categorias.forEach(c => catList.appendChild(el('option', { value: c })))

  // ── Preços ────────────────────────────────────────────────────────────────
  const custoInp = el('input', { type: 'number', id: 'pf-custo', step: '1', min: '0', placeholder: '0' })
  custoInp.value = produto?.precoCusto || ''

  const vendaInp = el('input', { type: 'number', id: 'pf-venda', step: '1', min: '0', placeholder: '0' })
  vendaInp.value = produto?.precoVenda || ''

  const margemEl = el('div', { class: 'margem-display' })

  function recalcMargem() {
    const c = parseFloat(custoInp.value) || 0
    const v = parseFloat(vendaInp.value) || 0
    const abs = v - c
    const pct = c > 0 ? ((abs / c) * 100).toFixed(1) : '—'
    margemEl.textContent = c > 0 ? `${abs >= 0 ? '+' : ''}${brl(abs)} (${pct}%)` : '—'
    margemEl.className   = 'margem-display ' + (abs >= 0 ? 'green' : 'red')
  }
  custoInp.addEventListener('input', recalcMargem)
  vendaInp.addEventListener('input', recalcMargem)
  recalcMargem()

  // ── Estoque ───────────────────────────────────────────────────────────────
  let controlaEstoque = !!produto?.controlaEstoque
  const estoqueFields = el('div', { class: 'estoque-fields' })
  const toggleBtn = el('button', { type: 'button', class: 'estoque-toggle' })

  function updateToggle() {
    toggleBtn.textContent = controlaEstoque ? 'Sim' : 'Não'
    toggleBtn.className   = 'estoque-toggle ' + (controlaEstoque ? 'active' : '')
    estoqueFields.style.display = controlaEstoque ? '' : 'none'
  }
  toggleBtn.addEventListener('click', () => { controlaEstoque = !controlaEstoque; updateToggle() })
  updateToggle()

  const estoqueAtualInp = el('input', { type: 'number', id: 'pf-est-atual', min: '0', step: '1', placeholder: '0' })
  estoqueAtualInp.value = produto?.estoqueAtual ?? ''

  const estoqueMinimoInp = el('input', { type: 'number', id: 'pf-est-min', min: '0', step: '1', placeholder: '0' })
  estoqueMinimoInp.value = produto?.estoqueMinimo ?? ''

  mount(estoqueFields,
    el('div', { class: 'field' },
      el('label', { for: 'pf-est-atual' }, 'Estoque atual'),
      estoqueAtualInp
    ),
    el('div', { class: 'field' },
      el('label', { for: 'pf-est-min' }, 'Estoque mínimo'),
      estoqueMinimoInp
    )
  )

  // ── Botões ────────────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  cancelBtn.addEventListener('click', close)

  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' },
    isEdit ? 'Salvar alterações' : 'Criar produto')

  submitBtn.addEventListener('click', async () => {
    const nome = nomeInp.value.trim()
    if (!nome) { toastError('Informe o nome do produto.'); return }

    submitBtn.disabled = true
    submitBtn.textContent = 'Salvando...'

    const data = {
      nome,
      categoria:       catInp.value.trim(),
      precoCusto:      custoInp.value,
      precoVenda:      vendaInp.value,
      controlaEstoque,
      estoqueAtual:    estoqueAtualInp.value,
      estoqueMinimo:   estoqueMinimoInp.value,
    }

    try {
      if (isEdit) {
        await updateProduto(produto.id, data, selectedFile)
        toastSuccess('Produto atualizado.')
      } else {
        await createProduto(data, selectedFile)
        toastSuccess('Produto criado.')
      }
      close()
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar produto.')
      submitBtn.disabled = false
      submitBtn.textContent = isEdit ? 'Salvar alterações' : 'Criar produto'
    }
  })

  // ── Layout ────────────────────────────────────────────────────────────────
  container.append(
    catList,
    el('div', { class: 'produto-form' },
      el('div', { class: 'produto-form-top' },
        el('div', { class: 'produto-form-fields' },
          el('div', { class: 'field field-full' },
            el('label', { for: 'pf-nome' }, 'Nome do produto'),
            nomeInp
          ),
          el('div', { class: 'field' },
            el('label', { for: 'pf-cat' }, 'Categoria'),
            catInp
          ),
        ),
        el('div', { class: 'produto-img-wrap' },
          el('label', {}, 'Imagem'),
          imgBox
        )
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Valores'),
        el('div', { class: 'form-grid' },
          el('div', { class: 'field' },
            el('label', { for: 'pf-custo' }, 'Preço de custo R$'),
            custoInp
          ),
          el('div', { class: 'field' },
            el('label', { for: 'pf-venda' }, 'Preço de venda R$'),
            vendaInp
          ),
          el('div', { class: 'field' },
            el('label', {}, 'Margem'),
            margemEl
          ),
        )
      ),
      el('div', { class: 'form-section' },
        el('p', { class: 'form-section-title' }, 'Estoque'),
        el('div', { class: 'estoque-toggle-row' },
          el('span', { class: 'estoque-toggle-label' }, 'Controlar estoque'),
          toggleBtn
        ),
        estoqueFields
      )
    ),
    el('div', { class: 'modal-footer' }, cancelBtn, submitBtn)
  )
}

function _cameraIcon() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '24', height: '24',
  })
  svg.appendChild(svgEl('path', { d: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' }))
  svg.appendChild(svgEl('circle', { cx: '12', cy: '13', r: '4' }))
  return svg
}
