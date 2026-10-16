import { el, mount } from '../../shared/utils/dom.js'
import { openModal } from '../../shared/components/Modal.js'
import {
  SOURCE_META, DISCARD_REASON_META, nomeExibicao, canalIcon, canalDoLead,
  formatDataHora, contarTentativas, contatoLocalizavel, resumoAnuncio, INTERESSE_META,
  linkContatoDireto,
} from './constants.js'

function toDate(ts) {
  if (!ts) return null
  return typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
}

// Notas mais recentes primeiro — quem abre quer ver rápido o que rolou no
// último contato, não reler a conversa inteira desde o início.
function notasOrdenadas(lead) {
  return [...(lead.notes || [])].sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0))
}

// Clicar em qualquer card do quadro (Novo, Em Follow-up, Sem Resposta,
// Convertido, Descartado) abre isso — histórico completo, não só a nota
// mais recente que já aparece resumida no card.
export function abrirHistoricoLead(lead) {
  const sourceMeta = SOURCE_META[lead.source] || SOURCE_META.whatsapp_direto

  openModal({
    title: `Histórico — ${nomeExibicao(lead)}`,
    size: 'lg',
    renderBody: (body) => {
      const linhas = []

      // Telefone/@ em destaque, bem no topo — é o dado que serve de verdade
      // pra localizar o contato fora do Eixo (WhatsApp ou Instagram). Ícone
      // do canal também vira link, quando dá — Instagram só leva pro Direct
      // geral (ver linkContatoDireto em constants.js), não tem como
      // confirmar o id da thread certa ainda.
      const linkDireto = linkContatoDireto(lead)
      const tituloLink = canalDoLead(lead) === 'whatsapp'
        ? `Abrir conversa — ${sourceMeta.label}`
        : `Abrir Direct (geral) — procure "${nomeExibicao(lead)}"`
      const iconeCanal = linkDireto
        ? el('a', { class: 'lead-hist-canal-link', href: linkDireto, target: '_blank', rel: 'noopener', title: tituloLink }, canalIcon(canalDoLead(lead)))
        : canalIcon(canalDoLead(lead))
      linhas.push(el('div', { class: 'lead-hist-origem' },
        iconeCanal,
        el('span', {}, sourceMeta.label),
        el('span', { class: 'lead-hist-dot' }, '·'),
        el('span', { class: 'lead-hist-contato' }, contatoLocalizavel(lead)),
      ))

      // Resumo do anúncio, não o texto inteiro — o card do anúncio às vezes
      // vem com título + corpo completo (uma promoção inteira), e isso vinha
      // virando um blocão gigante em maiúsculas atropelando a tela. Passa o
      // mouse pra ver completo.
      if (lead.adContext) linhas.push(el('span', { class: 'lead-ad-chip', title: lead.adContext }, `📢 ${resumoAnuncio(lead.adContext, 90)}`))

      // Resumo do atendimento: quantas tentativas, interesse e há quanto tempo
      // o lead entrou até o último registro.
      const notas = notasOrdenadas(lead).reverse() // mais antiga primeiro
      const inicio = toDate(lead.firstMessageAt) || toDate(lead.createdAt)
      const fim = toDate(lead.updatedAt)
      const dias = inicio && fim ? Math.max(0, Math.round((fim - inicio) / 86400000)) : null
      linhas.push(el('div', { class: 'lead-hist-resumo' },
        el('span', { class: 'lead-hist-tentativa-count' }, `${notas.length} tentativa${notas.length === 1 ? '' : 's'} de contato`),
        lead.interesse && INTERESSE_META[lead.interesse]
          ? el('span', { class: 'lead-hist-hora' }, `Interesse: ${INTERESSE_META[lead.interesse].estrelas} ${INTERESSE_META[lead.interesse].label}`) : null,
        dias != null ? el('span', { class: 'lead-hist-hora' }, `Atendimento de ${dias === 0 ? 'menos de 1 dia' : dias + ' dia' + (dias === 1 ? '' : 's')} (da primeira mensagem ao último registro)`) : null,
      ))

      // Linha do tempo em ordem cronológica: entrada → cada tentativa com o
      // comentário → situação atual / desfecho.
      const etapas = []
      etapas.push({ titulo: 'Lead entrou', data: lead.firstMessageAt || lead.createdAt, texto: lead.firstMessageText || null })
      notas.forEach((n, i) => etapas.push({ titulo: `Tentativa ${i + 1}`, autor: n.author, data: n.at, texto: n.text }))

      if (lead.status === 'descartado') {
        etapas.push({
          titulo: 'Descartado', data: lead.updatedAt, tom: 'fim',
          texto: [DISCARD_REASON_META[lead.discardReason] || lead.discardReason, lead.discardNote].filter(Boolean).join(' — ') || null,
        })
      } else if (lead.status === 'convertido') {
        etapas.push({ titulo: 'Convertido em cliente', data: lead.updatedAt, tom: 'ok' })
      } else if (lead.status === 'sem_resposta') {
        etapas.push({ titulo: 'Marcado como sem resposta', data: lead.updatedAt, tom: 'fim' })
      } else if (lead.nextFollowUpAt) {
        etapas.push({ titulo: 'Próximo retorno agendado', data: lead.nextFollowUpAt, tom: 'pendente' })
      }

      const timeline = el('div', { class: 'lead-hist-section' }, el('h4', {}, 'Linha do tempo do atendimento'))
      const lista = el('div', { class: 'lead-tl' })
      etapas.forEach(e => {
        lista.appendChild(el('div', { class: `lead-tl-item ${e.tom ? 'lead-tl-' + e.tom : ''}` },
          el('div', { class: 'lead-tl-head' },
            el('span', { class: 'lead-tl-titulo' }, e.titulo),
            e.autor ? el('span', { class: 'lead-tl-autor' }, `por ${e.autor}`) : null,
            el('span', { class: 'lead-tl-data' }, formatDataHora(e.data)),
          ),
          e.texto ? el('p', { class: 'lead-tl-texto' }, e.texto) : null,
        ))
      })
      if (!notas.length) {
        lista.appendChild(el('p', { class: 'lead-hist-vazio' }, 'Nenhuma tentativa de contato registrada neste lead.'))
      }
      timeline.appendChild(lista)
      linhas.push(timeline)

      mount(body, ...linhas.filter(Boolean))
    },
    footer: (close, footerEl) => {
      const fecharBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Fechar')
      fecharBtn.addEventListener('click', close)
      footerEl.append(fecharBtn)
    },
  })
}
