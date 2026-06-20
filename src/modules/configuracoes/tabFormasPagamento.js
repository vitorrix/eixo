import { el, mount } from '../../shared/utils/dom.js'
import { saveOperacoes } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

export function renderTabFormasPagamento(container, operacoes, onSaved) {
  let formas = operacoes.formasPagamento.map(f => ({ ...f }))
  const contas = operacoes.contas

  const listEl = el('div', { class: 'config-list' })

  function renderList() {
    listEl.replaceChildren()
    if (!formas.length) {
      listEl.appendChild(el('p', { class: 'text-muted' }, 'Nenhuma forma cadastrada.'))
      return
    }
    formas.forEach((f, i) => {
      const nomeInp = el('input', { type: 'text', placeholder: 'Ex: Pix' })
      nomeInp.value = f.nome || ''
      nomeInp.addEventListener('input', () => { formas[i].nome = nomeInp.value })

      const contaSel = el('select', { class: 'field-select' })
      contaSel.appendChild(el('option', { value: '' }, '— Conta padrão —'))
      contas.forEach(c => contaSel.appendChild(el('option', { value: c }, c)))
      contaSel.value = f.contaPadrao || ''
      contaSel.addEventListener('change', () => { formas[i].contaPadrao = contaSel.value })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => { formas.splice(i, 1); renderList() })

      listEl.appendChild(el('div', { class: 'config-list-item' }, nomeInp, contaSel, delBtn))
    })
  }

  renderList()

  const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar forma')
  addBtn.addEventListener('click', () => { formas.push({ nome: '', contaPadrao: '' }); renderList() })

  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar formas de pagamento')
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
    try {
      const updated = { ...operacoes, formasPagamento: formas }
      await saveOperacoes(updated)
      onSaved(updated)
      toastSuccess('Formas de pagamento salvas.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar.')
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar formas de pagamento'
    }
  })

  mount(container,
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Formas de Pagamento'),
      el('div', { class: 'config-list-header' },
        el('span', {}, 'Nome da forma'),
        el('span', {}, 'Conta padrão'),
        el('span', {})
      ),
      listEl,
      addBtn
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
