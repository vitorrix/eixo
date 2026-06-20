import { el } from '../../shared/utils/dom.js'
import { maskCPF, maskCNPJ, maskPhone, maskCEP, rawDigits } from '../../shared/utils/formatters.js'
import { validateCPF, validateCNPJ, validateEmail, validatePhone } from '../../shared/utils/validators.js'
import { buscarCEP } from '../../shared/utils/cep.js'
import { createFornecedor, updateFornecedor } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

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

  const phoneInput = makeInput('tel',   'ff-phone', { inputmode: 'numeric' })
  const phoneError = el('span', { class: 'field-error' })
  const phoneField = el('div', { class: 'field' },
    el('label', { for: 'ff-phone' }, 'Telefone / WhatsApp'), phoneInput, phoneError)

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

  // ── Observações ──────────────────────────────────────────────────────────
  const notesInput  = el('textarea', { id: 'ff-notes', rows: '2', class: 'field-textarea' })
  const notesField  = el('div', { class: 'field field-full' },
    el('label', { for: 'ff-notes' }, 'Observações (opcional)'), notesInput)

  // ── Seções do form ───────────────────────────────────────────────────────
  const sectionDados = el('div', { class: 'form-section' },
    el('p', { class: 'form-section-title' }, 'Dados'),
    el('div', { class: 'form-grid' },
      nameField, docField, phoneField, emailField, boxField
    )
  )

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
    typeToggle, sectionDados, sectionEndereco, sectionNotes
  )

  // ── Botões rodapé ────────────────────────────────────────────────────────
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
  const submitBtn = el('button', { type: 'button', class: 'btn btn-primary' },
    isEdit ? 'Salvar alterações' : 'Criar fornecedor')

  cancelBtn.addEventListener('click', close)
  submitBtn.addEventListener('click', () => form.requestSubmit())

  container.append(form, el('div', { class: 'modal-footer' }, cancelBtn, submitBtn))

  // ── Estado inicial ───────────────────────────────────────────────────────
  setType(currentType)
  if (isEdit) prefill(fornecedor)

  // ── Máscaras ─────────────────────────────────────────────────────────────
  docInput.addEventListener('input', () => {
    docInput.value = currentType === 'pf' ? maskCPF(docInput.value) : maskCNPJ(docInput.value)
  })
  phoneInput.addEventListener('input', () => { phoneInput.value = maskPhone(phoneInput.value) })
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
    nameInput.value   = f.name  || ''
    phoneInput.value  = maskPhone(f.phone || '')
    emailInput.value  = f.email || ''
    boxInput.value    = f.box   || ''
    notesInput.value  = f.notes || ''
    docInput.value    = f.type === 'pf' ? maskCPF(f.document || '') : maskCNPJ(f.document || '')
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
        type:     currentType,
        name:     nameInput.value,
        document: rawDigits(docInput.value),
        phone:    rawDigits(phoneInput.value),
        email:    emailInput.value,
        box:      boxInput.value,
        notes:    notesInput.value,
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

    if (phoneInput.value && !validatePhone(phoneInput.value)) {
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
