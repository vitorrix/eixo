import { el } from '../../shared/utils/dom.js'
import { maskCPF, maskCNPJ, maskPhone, maskCEP, rawDigits } from '../../shared/utils/formatters.js'
import { validateCPF, validateCNPJ, validateEmail, validatePhone } from '../../shared/utils/validators.js'
import { buscarCEP } from '../../shared/utils/cep.js'
import { createCliente, updateCliente } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

const UFs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export function renderClienteForm(container, close, cliente = null) {
  const isEdit = !!cliente

  // ── Toggle PF / PJ ───────────────────────────────────────────────────────
  const btnPF = el('button', { type: 'button', class: 'type-btn' }, 'Pessoa Física')
  const btnPJ = el('button', { type: 'button', class: 'type-btn' }, 'Pessoa Jurídica')
  const typeToggle = el('div', { class: 'type-toggle' }, btnPF, btnPJ)

  let currentType = cliente?.type || 'pf'

  // ── Campos — Dados ───────────────────────────────────────────────────────
  const nameInput   = makeInput('text',  'f-name',  { autocomplete: 'name' })
  const nameLabel   = el('label', { for: 'f-name' }, 'Nome completo')
  const nameError   = el('span', { class: 'field-error' })
  const nameField   = el('div', { class: 'field field-full' }, nameLabel, nameInput, nameError)

  const docInput    = makeInput('text',  'f-doc',   { inputmode: 'numeric' })
  const docLabel    = el('label', { for: 'f-doc' }, 'CPF')
  const docError    = el('span', { class: 'field-error' })
  const docField    = el('div', { class: 'field' }, docLabel, docInput, docError)

  const bdInput     = makeInput('date',  'f-bd')
  const bdLabel     = el('label', { for: 'f-bd' }, 'Data de nascimento')
  const bdField     = el('div', { class: 'field' }, bdLabel, bdInput)

  const phoneInput  = makeInput('tel',   'f-phone', { inputmode: 'numeric' })
  const phoneError  = el('span', { class: 'field-error' })
  const phoneField  = el('div', { class: 'field' },
    el('label', { for: 'f-phone' }, 'Telefone / WhatsApp'), phoneInput, phoneError)

  const emailInput  = makeInput('email', 'f-email', { autocomplete: 'email' })
  const emailError  = el('span', { class: 'field-error' })
  const emailField  = el('div', { class: 'field' },
    el('label', { for: 'f-email' }, 'E-mail'), emailInput, emailError)

  // ── Campos — Endereço ────────────────────────────────────────────────────
  const cepInput    = makeInput('text',  'f-cep',   { inputmode: 'numeric', placeholder: '00000-000' })
  const cepError    = el('span', { class: 'field-error' })
  const cepBtn      = el('button', { type: 'button', class: 'btn btn-outline btn-sm cep-btn' }, 'Buscar')
  const cepField    = el('div', { class: 'field' },
    el('label', { for: 'f-cep' }, 'CEP'),
    el('div', { class: 'cep-row' }, cepInput, cepBtn),
    cepError
  )

  const logradInput = makeInput('text',  'f-log')
  const logradField = el('div', { class: 'field field-grow' },
    el('label', { for: 'f-log' }, 'Logradouro'), logradInput)

  const numInput    = makeInput('text',  'f-num',   { style: 'width:90px' })
  const numField    = el('div', { class: 'field field-num' },
    el('label', { for: 'f-num' }, 'Número'), numInput)

  const bairroInput = makeInput('text',  'f-bairro')
  const bairroField = el('div', { class: 'field' },
    el('label', { for: 'f-bairro' }, 'Bairro'), bairroInput)

  const cidadeInput = makeInput('text',  'f-cidade')
  const cidadeField = el('div', { class: 'field field-grow' },
    el('label', { for: 'f-cidade' }, 'Cidade'), cidadeInput)

  const estadoSel   = el('select', { id: 'f-estado', class: 'field-select' })
  estadoSel.appendChild(el('option', { value: '' }, 'UF'))
  UFs.forEach(uf => estadoSel.appendChild(el('option', { value: uf }, uf)))
  const estadoField = el('div', { class: 'field field-uf' },
    el('label', { for: 'f-estado' }, 'Estado'), estadoSel)

  const compInput   = makeInput('text',  'f-comp')
  const compField   = el('div', { class: 'field field-full' },
    el('label', { for: 'f-comp' }, 'Complemento (opcional)'), compInput)

  // ── Observações ──────────────────────────────────────────────────────────
  const notesInput  = el('textarea', { id: 'f-notes', rows: '2', class: 'field-textarea' })
  const notesField  = el('div', { class: 'field field-full' },
    el('label', { for: 'f-notes' }, 'Observações (opcional)'), notesInput)

  // ── Seções do form ───────────────────────────────────────────────────────
  const sectionDados = el('div', { class: 'form-section' },
    el('p', { class: 'form-section-title' }, 'Dados'),
    el('div', { class: 'form-grid' },
      nameField, docField, bdField, phoneField, emailField
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
    isEdit ? 'Salvar alterações' : 'Criar cliente')

  cancelBtn.addEventListener('click', close)
  submitBtn.addEventListener('click', () => form.requestSubmit())

  container.append(form, el('div', { class: 'modal-footer' }, cancelBtn, submitBtn))

  // ── Estado inicial ───────────────────────────────────────────────────────
  setType(currentType)
  if (isEdit) prefill(cliente)

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
    docLabel.textContent = type === 'pf' ? 'CPF' : 'CNPJ'
    docInput.placeholder = type === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'
    nameLabel.textContent = type === 'pf' ? 'Nome completo' : 'Razão Social'
    bdLabel.textContent   = type === 'pf' ? 'Data de nascimento' : 'Data de abertura'
    bdField.style.display = ''
    docInput.value = ''
    clearError(docInput, docError)
  }

  btnPF.addEventListener('click', () => setType('pf'))
  btnPJ.addEventListener('click', () => setType('pj'))

  // ── Pré-preencher (edição) ───────────────────────────────────────────────
  function prefill(c) {
    nameInput.value   = c.name  || ''
    phoneInput.value  = maskPhone(c.phone || '')
    emailInput.value  = c.email || ''
    bdInput.value     = c.birthdate || ''
    notesInput.value  = c.notes || ''
    docInput.value    = c.type === 'pf' ? maskCPF(c.document || '') : maskCNPJ(c.document || '')
    const a = c.address || {}
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
        type:      currentType,
        name:      nameInput.value,
        document:  rawDigits(docInput.value),
        phone:     rawDigits(phoneInput.value),
        email:     emailInput.value,
        birthdate: bdInput.value,
        notes:     notesInput.value,
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
        await updateCliente(cliente.id, data)
        toastSuccess('Cliente atualizado com sucesso.')
      } else {
        await createCliente(data)
        toastSuccess('Cliente criado com sucesso.')
      }
      close()
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar. Tente novamente.')
      submitBtn.disabled = false
      submitBtn.textContent = isEdit ? 'Salvar alterações' : 'Criar cliente'
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
