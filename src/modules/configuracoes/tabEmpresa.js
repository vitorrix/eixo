import { el, mount } from '../../shared/utils/dom.js'
import { maskCNPJ, maskPhone, maskCEP, rawDigits } from '../../shared/utils/formatters.js'
import { buscarCEP } from '../../shared/utils/cep.js'
import { saveEmpresa } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

const UFs = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
             'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function inp(type, id, attrs = {}) {
  return el('input', { type, id, ...attrs })
}

function field(label, forId, input) {
  return el('div', { class: 'field' }, el('label', { for: forId }, label), input)
}

function fieldFull(label, forId, input) {
  return el('div', { class: 'field field-full' }, el('label', { for: forId }, label), input)
}

export function renderTabEmpresa(container, data, onSaved) {
  const razao    = inp('text',  'ce-razao')
  const fantasia = inp('text',  'ce-fantasia')
  const cnpj     = inp('text',  'ce-cnpj',  { inputmode: 'numeric' })
  const tel1     = inp('tel',   'ce-tel1')
  const tel2     = inp('tel',   'ce-tel2')
  const email    = inp('email', 'ce-email')
  const cepInp   = inp('text',  'ce-cep',   { placeholder: '00000-000', inputmode: 'numeric' })
  const logradInp = inp('text', 'ce-log')
  const numInp   = inp('text',  'ce-num')
  const compInp  = inp('text',  'ce-comp')
  const bairro   = inp('text',  'ce-bairro')
  const cidade   = inp('text',  'ce-cidade')

  const estado = el('select', { id: 'ce-estado', class: 'field-select' })
  estado.appendChild(el('option', { value: '' }, 'UF'))
  UFs.forEach(uf => estado.appendChild(el('option', { value: uf }, uf)))

  // Prefill
  razao.value     = data.razao    || ''
  fantasia.value  = data.fantasia || ''
  cnpj.value      = maskCNPJ(data.cnpj || '')
  tel1.value      = maskPhone(data.tel1 || '')
  tel2.value      = maskPhone(data.tel2 || '')
  email.value     = data.email    || ''
  const a = data.address || {}
  cepInp.value    = maskCEP(a.cep || '')
  logradInp.value = a.logradouro  || ''
  numInp.value    = a.numero      || ''
  compInp.value   = a.complemento || ''
  bairro.value    = a.bairro      || ''
  cidade.value    = a.cidade      || ''
  estado.value    = a.estado      || ''

  // Masks
  cnpj.addEventListener('input',  () => { cnpj.value  = maskCNPJ(cnpj.value) })
  tel1.addEventListener('input',  () => { tel1.value  = maskPhone(tel1.value) })
  tel2.addEventListener('input',  () => { tel2.value  = maskPhone(tel2.value) })
  cepInp.addEventListener('input',() => { cepInp.value = maskCEP(cepInp.value) })

  // CEP lookup
  const cepBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm cep-btn' }, 'Buscar')
  async function doBuscarCEP() {
    if (rawDigits(cepInp.value).length !== 8) return
    cepBtn.disabled = true; cepBtn.textContent = '...'
    try {
      const addr = await buscarCEP(cepInp.value)
      logradInp.value = addr.logradouro
      bairro.value    = addr.bairro
      cidade.value    = addr.cidade
      estado.value    = addr.estado
      numInp.focus()
    } catch {}
    finally { cepBtn.disabled = false; cepBtn.textContent = 'Buscar' }
  }
  cepBtn.addEventListener('click', doBuscarCEP)
  cepInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doBuscarCEP() } })

  // Save
  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar dados da empresa')
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
    try {
      const updated = {
        razao:    razao.value.trim(),
        fantasia: fantasia.value.trim(),
        cnpj:     rawDigits(cnpj.value),
        tel1:     rawDigits(tel1.value),
        tel2:     rawDigits(tel2.value),
        email:    email.value.trim().toLowerCase(),
        address: {
          cep:         rawDigits(cepInp.value),
          logradouro:  logradInp.value.trim(),
          numero:      numInp.value.trim(),
          complemento: compInp.value.trim(),
          bairro:      bairro.value.trim(),
          cidade:      cidade.value.trim(),
          estado:      estado.value,
        },
      }
      await saveEmpresa(updated)
      onSaved(updated)
      toastSuccess('Dados da empresa salvos.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar.')
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar dados da empresa'
    }
  })

  mount(container,
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Dados da Empresa'),
      el('div', { class: 'form-grid' },
        fieldFull('Razão Social',  'ce-razao',    razao),
        fieldFull('Nome Fantasia', 'ce-fantasia',  fantasia),
        field('CNPJ',             'ce-cnpj',      cnpj),
        field('E-mail',           'ce-email',     email),
        field('Telefone 1 (WhatsApp)', 'ce-tel1', tel1),
        field('Telefone 2',       'ce-tel2',      tel2),
      )
    ),
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Endereço'),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' },
          el('label', { for: 'ce-cep' }, 'CEP'),
          el('div', { class: 'cep-row' }, cepInp, cepBtn)
        ),
        el('div', { class: 'field-spacer' }),
        el('div', { class: 'form-grid-row' },
          el('div', { class: 'field field-grow' }, el('label', { for: 'ce-log' },    'Logradouro'), logradInp),
          el('div', { class: 'field field-num'  }, el('label', { for: 'ce-num' },    'Número'),     numInp),
        ),
        el('div', { class: 'form-grid-row' },
          el('div', { class: 'field' },            el('label', { for: 'ce-bairro' }, 'Bairro'),     bairro),
          el('div', { class: 'field field-grow' }, el('label', { for: 'ce-cidade' }, 'Cidade'),     cidade),
          el('div', { class: 'field field-uf'   }, el('label', { for: 'ce-estado' }, 'Estado'),     estado),
        ),
        fieldFull('Complemento (opcional)', 'ce-comp', compInp),
      )
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
