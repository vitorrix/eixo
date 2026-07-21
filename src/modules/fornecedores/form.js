import { el } from '../../shared/utils/dom.js'
import { maskCPF, maskCNPJ, maskCEP, rawDigits, fullDate } from '../../shared/utils/formatters.js'
import { validateCPF, validateCNPJ, validateEmail } from '../../shared/utils/validators.js'
import { buscarCEP } from '../../shared/utils/cep.js'
import { COUNTRIES, findCountryByDial, maskPhoneForCountry, validatePhoneForCountry, phonePlaceholderForCountry } from '../../shared/utils/countries.js'
import { createFornecedor, updateFornecedor, validarFornecedor } from './service.js'
import { validationStatus, VALIDATION_LABELS } from './validation.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

// Marca/tipo do que o fornecedor vende. "Semi-Novo" saiu daqui: condição
// (novo/usado) é outra dimensão, controlada pelo seletor CONDICOES abaixo — um
// fornecedor pode vender Apple novo E Apple semi-novo.
//
// "Android" fora por enquanto: a marcação aqui é o que o bot cola em CADA
// item que ele lê desse fornecedor (ver mapper.js) — não distingue produto
// por produto. Fornecedor marcado Apple+Android tinha iPhone aparecendo
// também na busca de Android, porque a IA só extrai Apple mesmo (o Android
// dele nunca é lido) e a etiqueta vinha inteira do cadastro. Volta quando a
// ingestão de Android existir de verdade.
const CATEGORIAS = [
  { value: 'apple',      label: 'Apple' },
  { value: 'acessorios', label: 'Acessórios' },
]

// Condição da lista do fornecedor. Manda na classificação novo/semi-novo das
// ofertas: 'novo'/'seminovo' forçam todos os itens; 'misto' deixa a IA decidir
// item a item (fornecedor que manda lacrados e semi-novos na mesma mensagem).
const CONDICOES = [
  { value: 'novo',     label: 'Só novo / lacrado' },
  { value: 'seminovo', label: 'Só semi-novo' },
  { value: 'misto',    label: 'Misto (novo e semi-novo na mesma lista)' },
]

const UFs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export function renderFornecedorForm(container, close, fornecedor = null) {
  const isEdit = !!fornecedor

  // ── Toggle PF / PJ ───────────────────────────────────────────────────────
  const btnPF = el('button', { type: 'button', class: 'type-btn' }, 'Pessoa Física')
  const btnPJ = el('button', { type: 'button', class: 'type-btn' }, 'Pessoa Jurídica')
  const typeToggle = el('div', { class: 'type-toggle' }, btnPF, btnPJ)

  let currentType = fornecedor?.type || 'pj'

  // ── Campos — Dados ───────────────────────────────────────────────────────
  const nameInput  = makeInput('text',  'ff-name',  { autocomplete: 'name' })
  const nameLabel  = el('label', { for: 'ff-name' }, 'Razão Social')
  const nameError  = el('span', { class: 'field-error' })
  const nameField  = el('div', { class: 'field field-full' }, nameLabel, nameInput, nameError)

  const docInput   = makeInput('text',  'ff-doc',   { inputmode: 'numeric' })
  const docLabel   = el('label', { for: 'ff-doc' }, 'CNPJ')
  const docError   = el('span', { class: 'field-error' })
  const docField   = el('div', { class: 'field' }, docLabel, docInput, docError)

  const countrySel = el('select', { id: 'ff-phone-country', class: 'field-select phone-country-select' })
  COUNTRIES.forEach(c => countrySel.appendChild(
    el('option', { value: c.dial }, `${c.flag} +${c.dial} ${c.name}`)
  ))
  let currentCountry = findCountryByDial(fornecedor?.phoneCountry || '55')
  countrySel.value = currentCountry.dial

  const phoneInput = makeInput('tel',   'ff-phone', { inputmode: 'numeric' })
  const phoneError = el('span', { class: 'field-error' })
  const phoneField = el('div', { class: 'field' },
    el('label', { for: 'ff-phone' }, 'Telefone / WhatsApp'),
    el('div', { class: 'phone-row' }, countrySel, phoneInput),
    phoneError)

  const vendedorInput = makeInput('text', 'ff-vendedor', { placeholder: 'Quem atende nesse número' })
  const vendedorField = el('div', { class: 'field' },
    el('label', { for: 'ff-vendedor' }, 'Nome do vendedor (opcional)'), vendedorInput)

  const emailInput = makeInput('email', 'ff-email', { autocomplete: 'email' })
  const emailError = el('span', { class: 'field-error' })
  const emailField = el('div', { class: 'field' },
    el('label', { for: 'ff-email' }, 'E-mail'), emailInput, emailError)

  const boxInput   = makeInput('text',  'ff-box',   { placeholder: 'Ex: Box 42 — Galeria Central' })
  const boxField   = el('div', { class: 'field field-full' },
    el('label', { for: 'ff-box' }, 'Box / Identificação na Galeria (opcional)'), boxInput)

  // ── Campos — Endereço ────────────────────────────────────────────────────
  const cepInput    = makeInput('text',  'ff-cep',   { inputmode: 'numeric', placeholder: '00000-000' })
  const cepError    = el('span', { class: 'field-error' })
  const cepBtn      = el('button', { type: 'button', class: 'btn btn-outline btn-sm cep-btn' }, 'Buscar')
  const cepField    = el('div', { class: 'field' },
    el('label', { for: 'ff-cep' }, 'CEP'),
    el('div', { class: 'cep-row' }, cepInput, cepBtn),
    cepError
  )

  const logradInput = makeInput('text',  'ff-log')
  const logradField = el('div', { class: 'field field-grow' },
    el('label', { for: 'ff-log' }, 'Logradouro'), logradInput)

  const numInput    = makeInput('text',  'ff-num',   { style: 'width:90px' })
  const numField    = el('div', { class: 'field field-num' },
    el('label', { for: 'ff-num' }, 'Número'), numInput)

  const bairroInput = makeInput('text',  'ff-bairro')
  const bairroField = el('div', { class: 'field' },
    el('label', { for: 'ff-bairro' }, 'Bairro'), bairroInput)

  const cidadeInput = makeInput('text',  'ff-cidade')
  const cidadeField = el('div', { class: 'field field-grow' },
    el('label', { for: 'ff-cidade' }, 'Cidade'), cidadeInput)

  const estadoSel   = el('select', { id: 'ff-estado', class: 'field-select' })
  estadoSel.appendChild(el('option', { value: '' }, 'UF'))
  UFs.forEach(uf => estadoSel.appendChild(el('option', { value: uf }, uf)))
  const estadoField = el('div', { class: 'field field-uf' },
    el('label', { for: 'ff-estado' }, 'Estado'), estadoSel)

  const compInput   = makeInput('text',  'ff-comp')
  const compField   = el('div', { class: 'field field-full' },
    el('label', { for: 'ff-comp' }, 'Complemento (opcional)'), compInput)

  // ── Categorias de produtos ───────────────────────────────────────────────
  const categoriaChecks = CATEGORIAS.map(c => {
    const checkbox = el('input', { type: 'checkbox', id: `ff-cat-${c.value}`, value: c.value })
    const label = el('label', { for: `ff-cat-${c.value}`, class: 'checkbox-pill' }, checkbox, c.label)
    return { value: c.value, checkbox, label }
  })
  const categoriasField = el('div', { class: 'field field-full' },
    el('label', {}, 'Trabalha com'),
    el('div', { class: 'checkbox-row' }, ...categoriaChecks.map(c => c.label))
  )

  // ── Condição da lista (novo / semi-novo / misto) ─────────────────────────
  const condicaoSelect = el('select', { id: 'ff-condicao', class: 'field-select' },
    ...CONDICOES.map(c => el('option', { value: c.value }, c.label))
  )
  const condicaoField = el('div', { class: 'field field-full' },
    el('label', { for: 'ff-condicao' }, 'Condição dos aparelhos'),
    condicaoSelect,
    el('span', { class: 'field-hint' }, 'Só semi-novo ou só novo classifica tudo do fornecedor de uma vez. Misto deixa o sistema decidir item a item.')
  )

  // ── Comunidade (grupo que envia lista diária de aparelhos/preços) ────────
  const comunidadeBtnSim = el('button', { type: 'button', class: 'type-btn type-btn-sm' }, 'Sim')
  const comunidadeBtnNao = el('button', { type: 'button', class: 'type-btn type-btn-sm' }, 'Não')
  const comunidadeToggle = el('div', { class: 'type-toggle type-toggle-sm' }, comunidadeBtnSim, comunidadeBtnNao)
  let comunidade = false

  function setComunidade(val) {
    comunidade = val
    comunidadeBtnSim.classList.toggle('active', val === true)
    comunidadeBtnNao.classList.toggle('active', val === false)
  }
  comunidadeBtnSim.addEventListener('click', () => setComunidade(true))
  comunidadeBtnNao.addEventListener('click', () => setComunidade(false))

  const comunidadeField = el('div', { class: 'field field-full' },
    el('label', {}, 'Comunidade'),
    comunidadeToggle,
    el('span', { class: 'field-hint' }, 'Fornecedor está no grupo que envia a lista diária de aparelhos e preços.')
  )

  // ── Validação (anti-golpe de clone) ──────────────────────────────────────
  const validationBadge = el('span', { class: 'badge' })
  const validationDetail = el('span', { class: 'field-hint' })
  const validarBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, 'Validar agora (chamada de vídeo)')
  const validationField = el('div', { class: 'field field-full validation-field' },
    el('label', {}, 'Validação do fornecedor'),
    el('div', { class: 'validation-row' }, validationBadge, validationDetail, validarBtn)
  )

  // ── Observações ──────────────────────────────────────────────────────────
  const notesInput  = el('textarea', { id: 'ff-notes', rows: '2', class: 'field-textarea' })
  const notesField  = el('div', { class: 'field field-full' },
    el('label', { for: 'ff-notes' }, 'Observações (opcional)'), notesInput)

  // ── Seções do form ───────────────────────────────────────────────────────
  const sectionDados = el('div', { class: 'form-section' },
    el('p', { class: 'form-section-title' }, 'Dados'),
    el('div', { class: 'form-grid' },
      nameField, docField, phoneField, vendedorField, emailField, boxField, categoriasField, condicaoField, comunidadeField
    )
  )

  const sectionValidacao = el('div', { class: 'form-section' }, validationField)

  const sectionEndereco = el('div', { class: 'form-section' },
    el('p', { class: 'form-section-title' }, 'Endereço'),
    el('div', { class: 'form-grid' },
      cepField,
      el('div', { class: 'field-spacer' }),
      el('div', { class: 'form-grid-row' }, logradField, numField),
      el('div', { class: 'form-grid-row' }, bairroField, cidadeField, estadoField),
      compField,
    )
  )

  const sectionNotes = el('div', { class: 'form-section' }, notesField)

  const form = el('form', { class: 'cliente-form', novalidate: '' },
    typeToggle, sectionDados, sectionValidacao, sectionEndereco, sectionNotes
  )

  // ── Botões rodapé ────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' },
    isEdit ? 'Salvar alterações' : 'Criar fornecedor')

  cancelBtn.addEventListener('click', close)
  submitBtn.addEventListener('click', () => form.requestSubmit())

  container.append(form, el('div', { class: 'modal-footer' }, cancelBtn, submitBtn))

  // ── Validação (anti-golpe de clone) ──────────────────────────────────────
  let currentFornecedor = fornecedor

  function renderValidation() {
    if (!isEdit) {
      validationBadge.textContent = 'Novo cadastro'
      validationBadge.className = 'badge'
      validationDetail.textContent = 'Salve o fornecedor e depois valide por chamada de vídeo.'
      validarBtn.classList.add('hidden')
      return
    }
    const { status, dueDate } = validationStatus(currentFornecedor?.lastValidatedAt)
    validationBadge.textContent = VALIDATION_LABELS[status]
    validationBadge.className = `badge badge-validation-${status}`
    validationDetail.textContent = dueDate
      ? `Válido até ${fullDate(dueDate.toISOString().slice(0, 10))}`
      : 'Este fornecedor ainda não foi validado por chamada de vídeo.'
    validarBtn.classList.remove('hidden')
  }

  validarBtn.addEventListener('click', async () => {
    if (!currentFornecedor?.id) return
    validarBtn.disabled = true
    validarBtn.textContent = 'Validando...'
    try {
      await validarFornecedor(currentFornecedor.id)
      currentFornecedor = { ...currentFornecedor, lastValidatedAt: { toDate: () => new Date() } }
      renderValidation()
      toastSuccess('Fornecedor validado.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao validar. Tente novamente.')
    } finally {
      validarBtn.disabled = false
      validarBtn.textContent = 'Validar agora (chamada de vídeo)'
    }
  })

  // ── Telefone / país ──────────────────────────────────────────────────────
  function setCountry(dial) {
    currentCountry = findCountryByDial(dial)
    countrySel.value = currentCountry.dial
    phoneInput.placeholder = phonePlaceholderForCountry(currentCountry)
    phoneInput.value = maskPhoneForCountry(phoneInput.value, currentCountry)
    clearError(phoneInput, phoneError)
  }

  countrySel.addEventListener('change', () => setCountry(countrySel.value))

  // ── Estado inicial ───────────────────────────────────────────────────────
  setType(currentType)
  setComunidade(fornecedor?.comunidade === true)
  setCountry(currentCountry.dial)
  if (isEdit) prefill(fornecedor)
  renderValidation()

  // ── Máscaras ─────────────────────────────────────────────────────────────
  docInput.addEventListener('input', () => {
    docInput.value = currentType === 'pf' ? maskCPF(docInput.value) : maskCNPJ(docInput.value)
  })
  phoneInput.addEventListener('input', () => { phoneInput.value = maskPhoneForCountry(phoneInput.value, currentCountry) })
  cepInput.addEventListener('input', () => { cepInput.value = maskCEP(cepInput.value) })

  // ── Busca de CEP ─────────────────────────────────────────────────────────
  async function doBuscarCEP() {
    const cep = cepInput.value
    if (rawDigits(cep).length !== 8) {
      cepError.textContent = 'Digite um CEP com 8 dígitos.'
      cepInput.classList.add('input-error')
      return
    }
    cepError.textContent = ''
    cepInput.classList.remove('input-error')
    cepBtn.disabled = true
    cepBtn.textContent = '...'
    try {
      const addr = await buscarCEP(cep)
      logradInput.value = addr.logradouro
      bairroInput.value = addr.bairro
      cidadeInput.value = addr.cidade
      estadoSel.value   = addr.estado
      numInput.focus()
    } catch (err) {
      cepError.textContent = err.message
      cepInput.classList.add('input-error')
    } finally {
      cepBtn.disabled = false
      cepBtn.textContent = 'Buscar'
    }
  }

  cepBtn.addEventListener('click', doBuscarCEP)
  cepInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doBuscarCEP() } })

  // ── Tipo PF/PJ ───────────────────────────────────────────────────────────
  function setType(type) {
    currentType = type
    btnPF.classList.toggle('active', type === 'pf')
    btnPJ.classList.toggle('active', type === 'pj')
    docLabel.textContent   = type === 'pf' ? 'CPF' : 'CNPJ'
    docInput.placeholder   = type === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'
    nameLabel.textContent  = type === 'pf' ? 'Nome completo' : 'Razão Social'
    docInput.value = ''
    clearError(docInput, docError)
  }

  btnPF.addEventListener('click', () => setType('pf'))
  btnPJ.addEventListener('click', () => setType('pj'))

  // ── Pré-preencher (edição) ───────────────────────────────────────────────
  function prefill(f) {
    nameInput.value     = f.name     || ''
    phoneInput.value    = maskPhoneForCountry(f.phone || '', currentCountry)
    vendedorInput.value = f.vendedor || ''
    emailInput.value    = f.email    || ''
    boxInput.value      = f.box      || ''
    notesInput.value    = f.notes    || ''
    docInput.value       = f.type === 'pf' ? maskCPF(f.document || '') : maskCNPJ(f.document || '')
    const categoriasSet  = new Set(f.categorias || [])
    categoriaChecks.forEach(c => { c.checkbox.checked = categoriasSet.has(c.value) })
    condicaoSelect.value = CONDICOES.some(c => c.value === f.condicao) ? f.condicao : 'misto'
    const a = f.address || {}
    cepInput.value    = maskCEP(a.cep || '')
    logradInput.value = a.logradouro  || ''
    numInput.value    = a.numero      || ''
    compInput.value   = a.complemento || ''
    bairroInput.value = a.bairro      || ''
    cidadeInput.value = a.cidade      || ''
    estadoSel.value   = a.estado      || ''
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    submitBtn.disabled = true
    submitBtn.textContent = 'Salvando...'

    try {
      const data = {
        type:       currentType,
        name:       nameInput.value,
        document:   rawDigits(docInput.value),
        phone:      rawDigits(phoneInput.value),
        phoneCountry: currentCountry.dial,
        vendedor:   vendedorInput.value,
        email:      emailInput.value,
        box:        boxInput.value,
        categorias: categoriaChecks.filter(c => c.checkbox.checked).map(c => c.value),
        condicao:   condicaoSelect.value,
        comunidade,
        notes:      notesInput.value,
        address: {
          cep:         cepInput.value,
          logradouro:  logradInput.value,
          numero:      numInput.value,
          complemento: compInput.value,
          bairro:      bairroInput.value,
          cidade:      cidadeInput.value,
          estado:      estadoSel.value,
        },
      }

      if (isEdit) {
        await updateFornecedor(fornecedor.id, data)
        toastSuccess('Fornecedor atualizado com sucesso.')
      } else {
        await createFornecedor(data)
        toastSuccess('Fornecedor criado com sucesso.')
      }
      close()
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar. Tente novamente.')
      submitBtn.disabled = false
      submitBtn.textContent = isEdit ? 'Salvar alterações' : 'Criar fornecedor'
    }
  })

  function validateForm() {
    let valid = true

    if (!nameInput.value.trim()) {
      setError(nameInput, nameError, 'Nome é obrigatório.')
      valid = false
    } else clearError(nameInput, nameError)

    const docRaw = rawDigits(docInput.value)
    if (docRaw) {
      const docOk = currentType === 'pf' ? validateCPF(docRaw) : validateCNPJ(docRaw)
      if (!docOk) {
        setError(docInput, docError, currentType === 'pf' ? 'CPF inválido.' : 'CNPJ inválido.')
        valid = false
      } else clearError(docInput, docError)
    } else clearError(docInput, docError)

    if (phoneInput.value && !validatePhoneForCountry(phoneInput.value, currentCountry)) {
      setError(phoneInput, phoneError, 'Telefone inválido.')
      valid = false
    } else clearError(phoneInput, phoneError)

    if (emailInput.value && !validateEmail(emailInput.value)) {
      setError(emailInput, emailError, 'E-mail inválido.')
      valid = false
    } else clearError(emailInput, emailError)

    return valid
  }
}

function makeInput(type, id, attrs = {}) {
  return el('input', { type, id, ...attrs })
}

function setError(input, errorEl, msg) {
  input.classList.add('input-error')
  errorEl.textContent = msg
}

function clearError(input, errorEl) {
  input.classList.remove('input-error')
  errorEl.textContent = ''
}
