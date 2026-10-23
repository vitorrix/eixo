import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase.js'
import { el, mount } from '../../shared/utils/dom.js'
import { can, getCurrentProfile } from '../../auth/session.js'
import { openModal } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

// Fornecedores cuja lista não diz se o aparelho é lacrado ou semi-novo (e sem
// padrão decidido). A resposta vira o padrão do fornecedor para as próximas
// listas e corrige as ofertas dele que estavam sem condição (aplicado pelo bot).
const COL = 'condicaoRevisao'

export function criarBotaoRevisaoCondicao() {
  const podeDecidir = can('busca', 'edit')
  let itens = []
  const badge = el('span', { class: 'count-badge' }, '0')
  const btn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '🏷️ Revisão de condição ', badge)
  btn.style.display = 'none'
  btn.addEventListener('click', abrirModal)

  const q = () => query(collection(db, COL), where('status', '==', 'pendente'))
  const ordenar = lista => lista.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.ocorrencias || 0) - (a.ocorrencias || 0))

  const unsub = onSnapshot(q(), snap => {
    itens = ordenar(snap.docs)
    badge.textContent = String(itens.length)
    btn.style.display = itens.length ? '' : 'none'
  }, err => console.error('Revisão de condição:', err))

  function abrirModal() {
    openModal({
      title: 'Revisão de condição dos fornecedores',
      size: 'lg',
      renderBody: (body, close) => {
        const lista = el('div', { class: 'rev-lista' })

        function itemEl(it) {
          async function decidir(dados, msg) {
            botoes.forEach(b => { b.disabled = true })
            try {
              await updateDoc(doc(db, COL, it.id), { ...dados, decididoPor: getCurrentProfile()?.name || '', decididoEm: serverTimestamp() })
              toastSuccess(msg)
            } catch (err) {
              console.error(err); toastError('Erro ao salvar a decisão.'); botoes.forEach(b => { b.disabled = false })
            }
          }
          const lac = el('button', { type: 'button', class: 'btn btn-sm btn-primary' }, 'Lacrado')
          const sem = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, 'Semi-novo')
          const ign = el('button', { type: 'button', class: 'btn btn-sm btn-ghost' }, 'Ignorar')
          const botoes = [lac, sem, ign]
          lac.addEventListener('click', () => decidir({ status: 'decidida', condicao: 'lacrado' }, 'Padrão salvo: Lacrado — o bot aplica nas ofertas em instantes.'))
          sem.addEventListener('click', () => decidir({ status: 'decidida', condicao: 'seminovo' }, 'Padrão salvo: Semi-novo — o bot aplica nas ofertas em instantes.'))
          ign.addEventListener('click', () => decidir({ status: 'ignorada' }, 'Item ignorado.'))
          return el('div', { class: 'rev-item' },
            el('div', { class: 'rev-info' },
              el('div', { class: 'rev-titulo' }, it.fornecedorNome || 'Fornecedor'),
              el('div', { class: 'rev-meta' }, `${it.ocorrencias || 0} oferta(s) sem condição informada na lista`),
              it.exemplo ? el('div', { class: 'rev-exemplo' }, `Ex.: ${it.exemplo}`) : null,
            ),
            podeDecidir ? el('div', { class: 'rev-acoes' }, lac, sem, ign) : el('div', { class: 'text-muted', style: 'font-size:12px' }, 'Sem permissão para decidir'),
          )
        }

        const desenhar = () => lista.replaceChildren(...(itens.length ? itens.map(itemEl) : [el('p', { class: 'text-muted' }, 'Nada pendente. 🎉')]))
        desenhar()
        const unsubModal = onSnapshot(q(), () => desenhar())
        const fechar = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fechar.addEventListener('click', () => { unsubModal(); close() })
        mount(body,
          el('p', { class: 'text-muted', style: 'font-size:13px;margin-bottom:12px' },
            'A lista destes fornecedores não diz se o aparelho é lacrado ou semi-novo. Em geral, o que eles mandam é: Lacrado ou Semi-novo? A resposta vira o padrão deles para as próximas listas.'),
          lista,
          el('div', { class: 'modal-footer' }, fechar),
        )
      },
    })
  }

  return { el: btn, destroy: () => unsub() }
}
