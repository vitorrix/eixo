import { el, mount } from '../../shared/utils/dom.js'
import { toolbarCard, toolbarMeta } from '../../shared/components/ToolbarCard.js'
import { textoUrgencia } from './constants.js'
import { marcarContatado, marcarSemResposta, converterEmCliente } from './service.js'
import { abrirFollowUpFormModal } from './followUpForm.js'
import { abrirDescartarModal } from './descartarForm.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

function toDate(ts) {
  if (!ts) return null
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
}

// "Marcar como Contatado" registra o que foi conversado e, opcionalmente, já
// deixa agendado o próximo retorno — sem reagendar, o lead continua em
// follow-up mas sem next date (some da ordenação por prazo, fica por último).
function abrirContatadoModal(lead) {
  openModal({
    title: `Contato — ${lead.name || lead.phone}`,
    size: 'sm',
    renderBody: (body) => {
      const notaInp = el('textarea', { rows: '3', class: 'field-textarea', placeholder: 'O que foi conversado...' })
      const reagendarChk = el('input', { type: 'checkbox' })
      reagendarChk.checked = true
      const dtInp = el('input', { type: 'datetime-local', class: 'field-input' })

      mount(body,
        el('div', { class: 'field' }, el('label', {}, 'Nota'), notaInp),
        el('div', { class: 'field', style: 'margin-top:14px' },
          el('label', { class: 'perm-label' }, reagendarChk, 'Reagendar novo retorno'),
          dtInp,
        ),
      )
      body._getPayload = () => ({
        nota: notaInp.value,
        proximoRetorno: reagendarChk.checked && dtInp.value ? new Date(dtInp.value) : null,
      })
      notaInp.focus()
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, 'Salvar')
      cancelBtn.addEventListener('click', close)
      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const payload = body?._getPayload?.()
        if (!payload?.nota?.trim()) return toastError('Descreva o que foi conversado.')
        saveBtn.disabled = true
        try {
          await marcarContatado(lead.id, payload)
          toastSuccess('Contato registrado.')
          close()
        } catch (err) {
          console.error(err)
          toastError('Erro ao salvar.')
          saveBtn.disabled = false
        }
      })
      footerEl.append(cancelBtn, saveBtn)
    },
  })
}

function leadRow(lead) {
  const { nivel, meta, texto } = textoUrgencia(lead.nextFollowUpAt)

  const contatadoBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Marcar como Contatado')
  contatadoBtn.addEventListener('click', () => abrirContatadoModal(lead))

  const semRespostaBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Sem Resposta')
  semRespostaBtn.addEventListener('click', () => {
    openConfirm({
      title: 'Marcar sem resposta?',
      message: `"${lead.name || lead.phone}" sai da fila de follow-up ativa.`,
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        try { await marcarSemResposta(lead.id); toastSuccess('Marcado como sem resposta.') }
        catch (err) { console.error(err); toastError('Erro ao atualizar.') }
      },
    })
  })

  const converterBtn = el('button', { type: 'button', class: 'btn btn-success btn-sm' }, 'Converter em Cliente')
  converterBtn.addEventListener('click', () => {
    openConfirm({
      title: 'Converter em cliente?',
      message: `Cria (ou vincula) o cadastro de "${lead.name || lead.phone}" em Clientes.`,
      confirmLabel: 'Converter',
      onConfirm: async () => {
        try { await converterEmCliente(lead); toastSuccess('Lead convertido em cliente.') }
        catch (err) { console.error(err); toastError('Erro ao converter.') }
      },
    })
  })

  const descartarBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Descartar')
  descartarBtn.addEventListener('click', () => abrirDescartarModal(lead))

  return el('div', { class: `lead-card lead-card--${nivel}` },
    el('div', { class: 'lead-card-head' },
      el('span', { class: 'lead-card-nome' }, lead.name || lead.phone),
      el('span', { class: 'lead-urgencia', style: `color:${meta.cor}` }, `${meta.icone} ${texto}`),
    ),
    el('div', { class: 'lead-card-actions' }, contatadoBtn, semRespostaBtn, converterBtn, descartarBtn),
  )
}

export function renderLeadsFollowup(container, leads) {
  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = toolbarCard(el('span', { class: 'lead-toolbar-title' }, '📞 Em Follow-up'), toolbarMeta(countBadge))

  const listWrap = el('div', { class: 'lead-cards-grid' })
  const emptyState = el('div', { class: 'empty-state' }, el('p', {}, 'Nenhum lead em follow-up no momento.'))

  function refresh() {
    const fila = leads
      .filter(l => l.status === 'em_followup')
      .sort((a, b) => {
        const da = toDate(a.nextFollowUpAt)?.getTime()
        const db_ = toDate(b.nextFollowUpAt)?.getTime()
        if (da == null) return 1
        if (db_ == null) return -1
        return da - db_
      })

    countBadge.textContent = `${fila.length} lead${fila.length === 1 ? '' : 's'}`
    listWrap.style.display = fila.length ? '' : 'none'
    emptyState.style.display = fila.length ? 'none' : ''
    listWrap.replaceChildren(...fila.map(leadRow))
  }

  mount(container, toolbar, listWrap, emptyState)
  refresh()

  return { update(newLeads) { leads = newLeads; refresh() } }
}
