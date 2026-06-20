import { el, mount } from '../../shared/utils/dom.js'
import { saveOperacoes } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

export function renderTabContas(container, operacoes, onSaved) {
  let contas = [...operacoes.contas]

  const listEl = el('div', { class: 'config-list' })

  function renderList() {
    listEl.replaceChildren()
    if (!contas.length) {
      listEl.appendChild(el('p', { class: 'text-muted' }, 'Nenhuma conta cadastrada.'))
      return
    }
    contas.forEach((c, i) => {
      const nomeInp = el('input', { type: 'text', placeholder: 'Ex: NuBank Baruk' })
      nomeInp.value = c
      nomeInp.addEventListener('input', () => { contas[i] = nomeInp.value })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => { contas.splice(i, 1); renderList() })

      listEl.appendChild(el('div', { class: 'config-list-item config-list-item--conta' }, nomeInp, delBtn))
    })
  }

  renderList()

  const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar conta')
  addBtn.addEventListener('click', () => { contas.push(''); renderList() })

  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar contas')
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
    try {
      const updated = { ...operacoes, contas }
      await saveOperacoes(updated)
      onSaved(updated)
      toastSuccess('Contas salvas.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar.')
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar contas'
    }
  })

  mount(container,
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Contas / Destinos'),
      listEl,
      addBtn
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
