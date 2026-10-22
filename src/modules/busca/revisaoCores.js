import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { can, getCurrentProfile } from '../../auth/session.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { coresOficiais } from '../../shared/utils/dicionarioCores.js'

// Fila de revisão de cores: textos de cor que o dicionário não reconheceu (ver
// dicionario-cores.json). O bot cria os itens; aqui a equipe escolhe a cor oficial
// (ou ignora) e o bot aplica de volta nas ofertas e aprende o apelido.
const COL = 'coresRevisao'

export function criarBotaoRevisaoCores() {
  const podeDecidir = can('busca', 'edit')
  let itens = []
  const badge = el('span', { class: 'count-badge' }, '0')
  const btn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '🎨 Revisão de cores ', badge)
  btn.style.display = 'none'
  btn.addEventListener('click', abrirModal)

  const unsub = onSnapshot(
    query(collection(db, COL), where('status', '==', 'pendente')),
    snap => {
      itens = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.ocorrencias || 0) - (a.ocorrencias || 0))
      badge.textContent = String(itens.length)
      btn.style.display = itens.length ? '' : 'none'
    },
    err => console.error('Revisão de cores:', err)
  )

  function abrirModal() {
    openModal({
      title: 'Revisão de cores',
      size: 'lg',
      renderBody: (body, close) => {
        const lista = el('div', { class: 'rev-lista' })
        const vazio = el('p', { class: 'text-muted' }, 'Nada pendente. 🎉')

        function itemEl(it) {
          const cores = coresOficiais(it.modelo)
          const sel = el('select', { class: 'field-select rev-sel' },
            el('option', { value: '' }, 'Cor oficial...'),
            ...cores.map(c => el('option', { value: c }, c)))
          const aplicar = el('button', { type: 'button', class: 'btn btn-sm btn-primary' }, 'Aplicar')
          aplicar.disabled = true
          sel.addEventListener('change', () => { aplicar.disabled = !sel.value })
          const ignorar = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, 'Ignorar')

          async function decidir(dados, msg) {
            aplicar.disabled = true; ignorar.disabled = true
            try {
              await updateDoc(doc(db, COL, it.id), {
                ...dados, decididoPor: getCurrentProfile()?.name || '', decididoEm: serverTimestamp(),
              })
              toastSuccess(msg)
            } catch (err) {
              console.error(err)
              toastError('Erro ao salvar a decisão.')
              ignorar.disabled = false; aplicar.disabled = !sel.value
            }
          }
          aplicar.addEventListener('click', () => decidir({ status: 'decidida', corOficial: sel.value }, 'Decisão enviada — o bot aplica nas ofertas em instantes.'))
          ignorar.addEventListener('click', () => decidir({ status: 'ignorada' }, 'Item ignorado.'))

          return el('div', { class: 'rev-item' },
            el('div', { class: 'rev-info' },
              el('div', { class: 'rev-titulo' }, it.modelo, el('span', { class: 'rev-texto' }, `“${it.textoCor}”`)),
              el('div', { class: 'rev-meta' }, `${it.ocorrencias || 0} oferta(s) · ${(it.fornecedores || []).length} fornecedor(es)`),
              it.exemplo ? el('div', { class: 'rev-exemplo' }, it.exemplo) : null,
            ),
            podeDecidir
              ? el('div', { class: 'rev-acoes' }, sel, aplicar, ignorar)
              : el('div', { class: 'text-muted', style: 'font-size:12px' }, 'Sem permissão para decidir'),
          )
        }

        // redesenha quando a fila muda (item decidido some)
        const desenhar = () => lista.replaceChildren(...(itens.length ? itens.map(itemEl) : [vazio]))
        desenhar()
        const unsubModal = onSnapshot(query(collection(db, COL), where('status', '==', 'pendente')), () => desenhar())

        const fechar = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fechar.addEventListener('click', () => { unsubModal(); close() })
        mount(body,
          el('p', { class: 'text-muted', style: 'font-size:13px;margin-bottom:12px' },
            'Textos de cor que o dicionário não reconheceu. Escolha a cor oficial do modelo para corrigir as ofertas e ensinar o sistema, ou ignore.'),
          lista,
          el('div', { class: 'modal-footer' }, fechar),
        )
      },
    })
  }

  return { el: btn, destroy: () => unsub() }
}
