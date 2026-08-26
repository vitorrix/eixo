import { el, mount } from '../../shared/utils/dom.js'
import { toolbarCard, toolbarMeta } from '../../shared/components/ToolbarCard.js'
import { SOURCE_META } from './constants.js'
import { iniciarFollowUp } from './service.js'
import { abrirFollowUpFormModal } from './followUpForm.js'
import { abrirDescartarModal } from './descartarForm.js'
import { toastSuccess } from '../../shared/components/Toast.js'

function toDate(ts) {
  if (!ts) return null
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
}

function horaCurta(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "Capturado hoje" é o caso comum (triagem diária), mas um lead "novo" de
// ontem que ninguém triou ainda não pode simplesmente sumir da tela — só
// entraria de novo se alguém soubesse procurar. Mostra todos os "novo",
// mais recentes primeiro, com uma marca de quantos dias atrás pros que não
// são de hoje (facilita ver o que ficou parado).
function diasAtras(ts) {
  const d = toDate(ts)
  if (!d) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const dia = new Date(d); dia.setHours(0, 0, 0, 0)
  return Math.round((hoje - dia) / 86400000)
}

function leadCard(lead) {
  const sourceMeta = SOURCE_META[lead.source] || SOURCE_META.whatsapp_direto
  const dias = diasAtras(lead.firstMessageAt)
  const quando = dias === 0 ? `hoje às ${horaCurta(lead.firstMessageAt)}` : `há ${dias} dia${dias === 1 ? '' : 's'}`

  const iniciarBtn = el('button', { type: 'button', class: 'btn btn-primary btn-sm' }, 'Iniciar Follow-up')
  iniciarBtn.addEventListener('click', () => {
    abrirFollowUpFormModal({
      titulo: `Follow-up — ${lead.name || lead.phone}`,
      confirmLabel: 'Iniciar',
      onConfirm: async (data) => {
        await iniciarFollowUp(lead.id, data)
        toastSuccess('Follow-up iniciado.')
      },
    })
  })

  const descartarBtn = el('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Descartar')
  descartarBtn.addEventListener('click', () => abrirDescartarModal(lead))

  return el('div', { class: 'lead-card' },
    el('div', { class: 'lead-card-head' },
      el('div', {},
        el('span', { class: 'lead-card-nome' }, lead.name || lead.phone),
        dias > 0 ? el('span', { class: 'lead-card-atraso' }, ` · parado ${quando}`) : null,
      ),
      el('span', { class: 'lead-card-hora' }, dias === 0 ? horaCurta(lead.firstMessageAt) : quando),
    ),
    lead.adContext ? el('span', { class: `badge ${sourceMeta.cls}` }, `via ${sourceMeta.label}`) : null,
    el('p', { class: 'lead-card-msg' }, lead.firstMessageText || '—'),
    el('div', { class: 'lead-card-actions' }, iniciarBtn, descartarBtn),
  )
}

export function renderLeadsNovos(container, leads) {
  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = toolbarCard(el('span', { class: 'lead-toolbar-title' }, '🆕 Novos Leads'), toolbarMeta(countBadge))

  const listWrap = el('div', { class: 'lead-cards-grid' })
  const emptyState = el('div', { class: 'empty-state' }, el('p', {}, 'Nenhum lead novo pra triar.'))

  function refresh() {
    const novos = leads
      .filter(l => l.status === 'novo')
      .sort((a, b) => (toDate(b.firstMessageAt)?.getTime() || 0) - (toDate(a.firstMessageAt)?.getTime() || 0))

    countBadge.textContent = `${novos.length} lead${novos.length === 1 ? '' : 's'}`
    listWrap.style.display = novos.length ? '' : 'none'
    emptyState.style.display = novos.length ? 'none' : ''
    listWrap.replaceChildren(...novos.map(leadCard))
  }

  mount(container, toolbar, listWrap, emptyState)
  refresh()

  return { update(newLeads) { leads = newLeads; refresh() } }
}
