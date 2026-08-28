import { el, mount } from '../../shared/utils/dom.js'
import { openModal } from '../../shared/components/Modal.js'
import {
  SOURCE_META, DISCARD_REASON_META, nomeExibicao, canalIcon, canalDoLead,
  formatDataHora, contarTentativas, contatoLocalizavel, resumoAnuncio,
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
    size: 'md',
    renderBody: (body) => {
      const linhas = []

      // Telefone/@ em destaque, bem no topo — é o dado que serve de verdade
      // pra localizar o contato fora do Eixo (WhatsApp ou Instagram).
      linhas.push(el('div', { class: 'lead-hist-origem' },
        canalIcon(canalDoLead(lead)),
        el('span', {}, sourceMeta.label),
        el('span', { class: 'lead-hist-dot' }, '·'),
        el('span', { class: 'lead-hist-contato' }, contatoLocalizavel(lead)),
      ))

      // Resumo do anúncio, não o texto inteiro — o card do anúncio às vezes
      // vem com título + corpo completo (uma promoção inteira), e isso vinha
      // virando um blocão gigante em maiúsculas atropelando a tela. Passa o
      // mouse pra ver completo.
      if (lead.adContext) linhas.push(el('span', { class: 'lead-ad-chip', title: lead.adContext }, `📢 ${resumoAnuncio(lead.adContext, 90)}`))

      linhas.push(el('div', { class: 'lead-hist-section' },
        el('h4', {}, 'Primeira mensagem'),
        el('p', { class: 'lead-hist-msg' }, lead.firstMessageText || '—'),
        el('span', { class: 'lead-hist-hora' }, formatDataHora(lead.firstMessageAt)),
      ))

      if (lead.status === 'em_followup' || lead.status === 'sem_resposta') {
        linhas.push(el('div', { class: 'lead-hist-section' },
          el('h4', {}, 'Tentativas de contato'),
          el('span', { class: 'lead-hist-tentativa-count' }, `Tentativa ${contarTentativas(lead)}`),
          lead.nextFollowUpAt ? el('span', { class: 'lead-hist-hora' }, `Próximo retorno: ${formatDataHora(lead.nextFollowUpAt)}`) : null,
        ))
      }

      const notas = notasOrdenadas(lead)
      const notasSection = el('div', { class: 'lead-hist-section' }, el('h4', {}, 'Contatos registrados'))
      if (notas.length) {
        notas.forEach(n => {
          notasSection.appendChild(el('div', { class: 'lead-hist-nota' },
            el('div', { class: 'lead-hist-nota-head' },
              el('span', { class: 'lead-hist-nota-autor' }, n.author || '—'),
              el('span', { class: 'lead-hist-nota-data' }, formatDataHora(n.at)),
            ),
            el('p', { class: 'lead-hist-nota-texto' }, n.text),
          ))
        })
      } else {
        notasSection.appendChild(el('p', { class: 'lead-hist-vazio' }, 'Nenhum contato registrado ainda.'))
      }
      linhas.push(notasSection)

      if (lead.status === 'descartado') {
        linhas.push(el('div', { class: 'lead-hist-section' },
          el('h4', {}, 'Descarte'),
          el('p', {}, DISCARD_REASON_META[lead.discardReason] || lead.discardReason || '—'),
          lead.discardNote ? el('p', { class: 'lead-hist-hora' }, lead.discardNote) : null,
        ))
      }

      if (lead.status === 'convertido') {
        linhas.push(el('div', { class: 'lead-hist-section' }, el('p', {}, '✅ Convertido em cliente.')))
      }

      mount(body, ...linhas.filter(Boolean))
    },
    footer: (close, footerEl) => {
      const fecharBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Fechar')
      fecharBtn.addEventListener('click', close)
      footerEl.append(fecharBtn)
    },
  })
}
