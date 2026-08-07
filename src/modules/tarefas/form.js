import { el, mount } from '../../shared/utils/dom.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { RESPONSAVEIS, createTarefa, updateTarefa } from './service.js'
import { PRIORIDADES } from './constants.js'

// Usado tanto pela lista completa (#/tarefas) quanto pelo botão flutuante
// disponível em qualquer tela e pelo widget do Dashboard — um só lugar pra
// manter o formulário de tarefa em vez de duplicar em cada ponto de entrada.
export function abrirTarefaFormModal(tarefa) {
  const isEdit = !!tarefa

  openModal({
    title: isEdit ? 'Editar tarefa' : 'Nova tarefa',
    size: 'md',
    renderBody: (body) => {
      const tituloInp = el('input', { type: 'text', class: 'field-input', placeholder: 'Ex: Ligar pro fornecedor X' })
      tituloInp.value = tarefa?.titulo || ''

      const descInp = el('textarea', { rows: '3', class: 'field-textarea' })
      descInp.value = tarefa?.descricao || ''

      const respState = new Set(tarefa?.responsaveis || [])
      const respBtns = RESPONSAVEIS.map(r => {
        const btn = el('button', { type: 'button', class: 'status-chip-btn' }, r.nome)
        if (respState.has(r.uid)) btn.classList.add('active')
        btn.addEventListener('click', () => {
          if (respState.has(r.uid)) respState.delete(r.uid)
          else respState.add(r.uid)
          btn.classList.toggle('active', respState.has(r.uid))
        })
        return btn
      })
      const respRow = el('div', { class: 'status-chips-row' }, ...respBtns)

      let prioridade = tarefa?.prioridade || 'media'
      const prioBtns = PRIORIDADES.map(p => {
        const btn = el('button', { type: 'button', class: 'status-chip-btn' }, p.label)
        if (p.key === prioridade) btn.classList.add('active')
        btn.addEventListener('click', () => {
          prioridade = p.key
          prioBtns.forEach(b => b.classList.remove('active'))
          btn.classList.add('active')
        })
        return btn
      })
      const prioRow = el('div', { class: 'status-chips-row' }, ...prioBtns)

      const prazoInp = el('input', { type: 'datetime-local', class: 'field-input' })
      prazoInp.value = tarefa?.prazo || ''

      mount(body,
        el('div', { class: 'field' }, el('label', {}, 'Título'), tituloInp),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Descrição'), descInp),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Responsável'), respRow),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Prioridade'), prioRow),
        el('div', { class: 'field', style: 'margin-top:14px' },
          el('label', {}, 'Prazo'), prazoInp),
      )

      body._getPayload = () => ({
        titulo: tituloInp.value.trim(),
        descricao: descInp.value.trim(),
        responsaveis: [...respState],
        prioridade,
        prazo: prazoInp.value,
      })

      tituloInp.focus()
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, isEdit ? 'Salvar' : 'Criar tarefa')

      cancelBtn.addEventListener('click', close)
      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const payload = body?._getPayload?.()
        if (!payload) return

        if (!payload.titulo) return toastError('Informe o título da tarefa.')
        if (!payload.responsaveis.length) return toastError('Marque ao menos um responsável.')

        saveBtn.disabled = true
        saveBtn.textContent = 'Salvando...'
        try {
          if (isEdit) {
            await updateTarefa(tarefa.id, payload)
            toastSuccess('Tarefa atualizada.')
          } else {
            await createTarefa(payload)
            toastSuccess('Tarefa criada.')
          }
          close()
        } catch (err) {
          console.error(err)
          toastError('Erro ao salvar tarefa.')
          saveBtn.disabled = false
          saveBtn.textContent = isEdit ? 'Salvar' : 'Criar tarefa'
        }
      })

      footerEl.append(cancelBtn, saveBtn)
    },
  })
}
