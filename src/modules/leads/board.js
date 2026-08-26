import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { whatsappIcon } from '../../shared/utils/whatsapp.js'
import { COLUNAS, SOURCE_META, nomeExibicao, textoUrgencia, canalDoLead } from './constants.js'
import { renomearLead, iniciarFollowUp, marcarContatado, marcarSemResposta, converterEmCliente } from './service.js'
import { abrirFollowUpFormModal } from './followUpForm.js'
import { abrirDescartarModal } from './descartarForm.js'

// Glifo simplificado (câmera + lente + flash), sem o gradiente oficial —
// só pra diferenciar rápido dos cards de WhatsApp, mesmo estilo de traço
// dos ícones do menu lateral.
function instagramIcon() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '15', height: '15',
  })
  svg.append(
    svgEl('rect', { x: '2', y: '2', width: '20', height: '20', rx: '5' }),
    svgEl('circle', { cx: '12', cy: '12', r: '4' }),
    svgEl('line', { x1: '17.5', y1: '6.5', x2: '17.51', y2: '6.5' }),
  )
  return svg
}

function canalIcon(canal) {
  return canal === 'instagram' ? instagramIcon() : whatsappIcon()
}

function toDate(ts) {
  if (!ts) return null
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
}

function relativo(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  const dias = Math.round((new Date() - d) / 86400000)
  if (dias <= 0) return 'hoje'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias} dias`
}

// Nome clicável: vira campo de texto no lugar, salva ao sair do campo ou
// Enter. "Vamos nomear o lead também, não deixar só o número" — cai pro
// telefone formatado enquanto não for renomeado, nunca o número cru.
function nomeEditavelEl(lead) {
  const wrap = el('span', { class: 'lead-card-nome-wrap' })

  function mostrar() {
    wrap.replaceChildren()
    const txt = el('span', { class: 'lead-card-nome', title: 'Clique para renomear' }, nomeExibicao(lead))
    txt.addEventListener('click', (e) => { e.stopPropagation(); editar() })
    wrap.appendChild(txt)
  }

  function editar() {
    wrap.replaceChildren()
    const inp = el('input', { type: 'text', class: 'lead-card-nome-inp', value: lead.name || '' })
    inp.placeholder = nomeExibicao(lead)
    const salvar = async () => {
      const novo = inp.value.trim()
      wrap.replaceChildren()
      wrap.appendChild(el('span', { class: 'lead-card-nome' }, novo || nomeExibicao(lead)))
      if (novo !== (lead.name || '')) {
        try { await renomearLead(lead.id, novo) }
        catch (err) { console.error(err); toastError('Erro ao renomear.') }
      }
    }
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') inp.blur()
      if (e.key === 'Escape') { inp.value = lead.name || ''; inp.blur() }
    })
    inp.addEventListener('blur', salvar, { once: true })
    inp.addEventListener('click', e => e.stopPropagation())
    wrap.appendChild(inp)
    inp.focus()
    inp.select()
  }

  mostrar()
  return wrap
}

// "Marcar Contatado" não muda de coluna por si só (registra nota, e
// opcionalmente já agenda o próximo retorno) — só faz sentido em
// Em Follow-up, por isso não vira um alvo de arrastar.
function botaoNota(lead) {
  const btn = el('button', { type: 'button', class: 'lead-card-nota-btn', title: 'Registrar contato' }, '🗒️ Nota')
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    openModal({
      title: `Contato — ${nomeExibicao(lead)}`,
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
  })
  return btn
}

function leadCard(lead) {
  const sourceMeta = SOURCE_META[lead.source] || SOURCE_META.whatsapp_direto

  const card = el('div', { class: 'lead-card', draggable: 'true' })
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', lead.id)
    e.dataTransfer.effectAllowed = 'move'
    requestAnimationFrame(() => card.classList.add('lead-card-dragging'))
  })
  card.addEventListener('dragend', () => card.classList.remove('lead-card-dragging'))

  const canalEl = el('span', { class: 'lead-card-canal', title: sourceMeta.label }, canalIcon(canalDoLead(lead)))
  const head = el('div', { class: 'lead-card-head' }, nomeEditavelEl(lead), canalEl)

  const linhas = [head]

  if (lead.status === 'novo') {
    if (lead.adContext) linhas.push(el('span', { class: `badge ${sourceMeta.cls}` }, lead.adContext))
    linhas.push(el('p', { class: 'lead-card-msg' }, lead.firstMessageText || '—'))
    linhas.push(el('span', { class: 'lead-card-hora' }, relativo(lead.firstMessageAt)))
  } else if (lead.status === 'em_followup') {
    const { meta, texto } = textoUrgencia(lead.nextFollowUpAt)
    linhas.push(el('span', { class: 'lead-urgencia', style: `color:${meta.cor}` }, `${meta.icone} ${texto}`))
    linhas.push(el('div', { class: 'lead-card-actions' }, botaoNota(lead)))
  } else {
    linhas.push(el('span', { class: 'lead-card-hora' }, `atualizado ${relativo(lead.updatedAt)}`))
    if (lead.discardReason) linhas.push(el('span', { class: 'lead-card-hora' }, lead.discardReason))
  }

  mount(card, ...linhas)
  return card
}

function handleDrop(lead, targetStatus) {
  if (lead.status === targetStatus) return

  if (targetStatus === 'em_followup') {
    abrirFollowUpFormModal({
      titulo: `Follow-up — ${nomeExibicao(lead)}`,
      confirmLabel: lead.status === 'novo' ? 'Iniciar' : 'Reagendar',
      onConfirm: async (data) => {
        await iniciarFollowUp(lead.id, data)
        toastSuccess('Follow-up definido.')
      },
    })
    return
  }

  if (targetStatus === 'sem_resposta') {
    openConfirm({
      title: 'Marcar sem resposta?',
      message: `"${nomeExibicao(lead)}" sai da fila de follow-up ativa.`,
      confirmLabel: 'Confirmar',
      onConfirm: async () => {
        try { await marcarSemResposta(lead.id); toastSuccess('Atualizado.') }
        catch (err) { console.error(err); toastError('Erro ao atualizar.') }
      },
    })
    return
  }

  if (targetStatus === 'convertido') {
    openConfirm({
      title: 'Converter em cliente?',
      message: `Cria (ou vincula) o cadastro de "${nomeExibicao(lead)}" em Clientes.`,
      confirmLabel: 'Converter',
      onConfirm: async () => {
        try { await converterEmCliente(lead); toastSuccess('Lead convertido em cliente.') }
        catch (err) { console.error(err); toastError('Erro ao converter.') }
      },
    })
    return
  }

  if (targetStatus === 'descartado') {
    abrirDescartarModal(lead)
  }
}

// Um quadro completo (5 colunas) pra um subconjunto de leads — reaproveitado
// duas vezes por renderLeadsBoard, um por canal, já que arrastar só precisa
// achar o lead dentro do MESMO subconjunto que esse quadro já tem em mãos.
function buildQuadro(container, leads) {
  const bodies = {}
  const counts = {}

  const colEls = COLUNAS.map(c => {
    counts[c.status] = el('span', { class: 'lead-col-count' })
    bodies[c.status] = el('div', { class: 'lead-col-body' })
    const colEl = el('div', { class: `lead-col lead-col--${c.status}` },
      el('div', { class: 'lead-col-head' }, el('span', {}, c.titulo), counts[c.status]),
      bodies[c.status],
    )

    if (c.aceitaDrop) {
      bodies[c.status].addEventListener('dragover', (e) => { e.preventDefault(); colEl.classList.add('lead-col-over') })
      bodies[c.status].addEventListener('dragleave', () => colEl.classList.remove('lead-col-over'))
      bodies[c.status].addEventListener('drop', (e) => {
        e.preventDefault()
        colEl.classList.remove('lead-col-over')
        const leadId = e.dataTransfer.getData('text/plain')
        const lead = leads.find(l => l.id === leadId)
        if (lead) handleDrop(lead, c.status)
      })
    }
    return colEl
  })

  function refresh() {
    COLUNAS.forEach(c => {
      let doStatus = leads.filter(l => l.status === c.status)
      if (c.status === 'novo') doStatus.sort((a, b) => (toDate(b.firstMessageAt)?.getTime() || 0) - (toDate(a.firstMessageAt)?.getTime() || 0))
      else if (c.status === 'em_followup') doStatus.sort((a, b) => {
        const da = toDate(a.nextFollowUpAt)?.getTime(); const db_ = toDate(b.nextFollowUpAt)?.getTime()
        if (da == null) return 1; if (db_ == null) return -1; return da - db_
      })
      else doStatus.sort((a, b) => (toDate(b.updatedAt)?.getTime() || 0) - (toDate(a.updatedAt)?.getTime() || 0))

      counts[c.status].textContent = String(doStatus.length)
      const limitado = c.limite ? doStatus.slice(0, c.limite) : doStatus
      const filhos = limitado.map(leadCard)
      if (c.limite && doStatus.length > c.limite) {
        filhos.push(el('a', { href: '#/leads', class: 'lead-col-vertodos' }, `+${doStatus.length - c.limite} no Histórico →`))
      }
      bodies[c.status].replaceChildren(...filhos)
    })
  }

  mount(container, el('div', { class: 'lead-board' }, ...colEls))
  refresh()

  return { update(newLeads) { leads = newLeads; refresh() } }
}

function secaoQuadro(titulo, icone) {
  const body = el('div', {})
  const secao = el('div', { class: 'lead-board-section' },
    el('h3', { class: 'lead-board-section-title' }, icone, el('span', {}, titulo)),
    body,
  )
  return { secao, body }
}

// "2 quadros iguais, um do Instagram e outro do WhatsApp" — mesma estrutura
// de colunas nos dois, só separa os leads por canal. O quadro do Instagram
// fica vazio até a fase 2 (bot ainda não captura Instagram Direct).
export function renderLeadsBoard(container, allLeads) {
  const wpp = secaoQuadro('WhatsApp', whatsappIcon())
  const ig  = secaoQuadro('Instagram', instagramIcon())

  mount(container, el('div', { class: 'lead-boards-stack' }, wpp.secao, ig.secao))

  const porCanal = (canal) => allLeads.filter(l => canalDoLead(l) === canal)
  const ctrlWpp = buildQuadro(wpp.body, porCanal('whatsapp'))
  const ctrlIg  = buildQuadro(ig.body, porCanal('instagram'))

  return {
    update(newLeads) {
      allLeads = newLeads
      ctrlWpp.update(porCanal('whatsapp'))
      ctrlIg.update(porCanal('instagram'))
    },
  }
}
