import { el, svgEl, mount } from '../../shared/utils/dom.js'
import { shortDateTime } from '../../shared/utils/formatters.js'
import { toastError } from '../../shared/components/Toast.js'
import { responsavel, marcarStatus } from '../tarefas/service.js'
import { abrirTarefaFormModal } from '../tarefas/form.js'
import { SEM_PRAZO, isAtrasada, proximoStatus } from '../tarefas/constants.js'

// Cor da barra lateral por prioridade — mesmo código de cor dos badges
// (badge-prioridade-*), só que como uma faixa fina em vez de um chip, pra
// não competir visualmente com o círculo de status no card compacto.
const PRIORIDADE_COR = { baixa: '#9ca3af', media: '#3b82f6', alta: '#dc2626' }

// Quantas linhas cabem sem o card ficar maior que o Mural/Gráfico ao lado —
// o resto fica a um clique em "Ver todas".
const MAX_VISIVEIS = 6

function buildIcon() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: '#123C43',
    'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    width: '18', height: '18',
  })
  svg.append(
    svgEl('path', { d: 'M9 11l3 3L22 4' }),
    svgEl('path', { d: 'M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' }),
  )
  return svg
}

function buildPlusIcon() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': '2.5', 'stroke-linecap': 'round',
    width: '14', height: '14',
  })
  svg.append(svgEl('path', { d: 'M12 5v14M5 12h14' }))
  return svg
}

function avatarDot(uid) {
  const r = responsavel(uid)
  if (!r) return null
  return el('span', {
    class: 'tarefa-avatar-dot',
    style: `background:${r.cor}`,
    title: r.nome,
  }, r.nome[0])
}

function statusToggle(t) {
  const emAndamento = t.status === 'em_andamento'
  const btn = el('button', {
    type: 'button',
    class: `tarefa-status-toggle${emAndamento ? ' tarefa-status-toggle--meio' : ''}`,
    title: emAndamento ? 'Em andamento — clique pra concluir' : 'Clique pra iniciar',
  })
  btn.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      await marcarStatus(t.id, proximoStatus(t.status))
    } catch (err) {
      console.error(err)
      toastError('Erro ao atualizar status.')
    }
  })
  return btn
}

function tarefaRow(t) {
  const atrasada = isAtrasada(t)
  const cor = PRIORIDADE_COR[t.prioridade] || PRIORIDADE_COR.media

  const meta = el('div', { class: 'tarefa-row-meta' },
    t.prazo ? el('span', { class: atrasada ? 'tarefa-prazo-atrasado' : '' }, shortDateTime(t.prazo)) : el('span', {}, 'Sem prazo'),
    el('span', { class: 'tarefa-row-avatars' }, ...(t.responsaveis || []).map(avatarDot).filter(Boolean)),
  )

  const row = el('div', { class: 'tarefa-row', style: `border-left-color:${cor}` },
    statusToggle(t),
    el('div', { class: 'tarefa-row-body' },
      el('div', { class: 'tarefa-row-title' }, t.titulo || '—'),
      meta,
    ),
  )
  row.addEventListener('click', () => abrirTarefaFormModal(t))
  return row
}

function buildEmptyState() {
  const btn = el('button', { type: 'button', class: 'btn btn-primary btn-sm' }, '+ Criar tarefa')
  btn.addEventListener('click', () => abrirTarefaFormModal())
  return el('div', { class: 'tarefa-widget-empty' },
    el('p', {}, 'Nenhuma tarefa sua em aberto.'),
    btn,
  )
}

// tarefas: array completo (já em tempo real via subscribeTarefas do Dashboard)
// currentUid: quem está logado — cada um só vê a própria fila (mais as
// compartilhadas, já que "responsaveis" pode ter os dois uids).
export function buildTarefasWidget(tarefas, currentUid) {
  const minhas = tarefas
    .filter(t => t.status !== 'concluida' && (t.responsaveis || []).includes(currentUid))
    .sort((a, b) => (a.prazo || SEM_PRAZO).localeCompare(b.prazo || SEM_PRAZO))

  const addBtn = el('button', { type: 'button', class: 'icon-btn icon-btn-edit tarefa-widget-add-btn', title: 'Nova tarefa' }, buildPlusIcon())
  addBtn.addEventListener('click', () => abrirTarefaFormModal())

  const listWrap = minhas.length
    ? el('div', { class: 'tarefa-widget-list' }, ...minhas.slice(0, MAX_VISIVEIS).map(tarefaRow))
    : buildEmptyState()

  return el('div', { class: 'mural-card tarefa-widget-card' },
    el('div', { class: 'mural-header' },
      buildIcon(),
      el('span', { class: 'mural-title' }, 'Minhas Tarefas'),
      minhas.length ? el('span', { class: 'count-badge' }, String(minhas.length)) : null,
      addBtn,
    ),
    listWrap,
    el('a', { href: '#/tarefas', class: 'tarefa-widget-footer-link' }, 'Ver todas as tarefas →'),
  )
}
