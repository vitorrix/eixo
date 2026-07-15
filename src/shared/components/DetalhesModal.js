import { el, mount } from '../utils/dom.js'
import { openModal } from './Modal.js'

// Janela de consulta genérica pra Pedido/Compra/Venda — abre ao clicar na linha
// da tabela, só de leitura. Editar/Imprimir/Recibo (quando presentes) fecham
// essa janela e abrem a ação real (form de edição ou o recibo).
export function abrirDetalhesModal({ title, campos, onEditar, onImprimir, onRecibo }) {
  openModal({
    title,
    size: 'md',
    renderBody: (body, close) => {
      const linhas = campos.filter(Boolean).map(([label, valor]) =>
        el('div', { class: 'detalhes-linha' },
          el('span', { class: 'detalhes-label' }, label),
          el('span', { class: 'detalhes-valor' }, valor || '—'),
        )
      )

      const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
      fecharBtn.addEventListener('click', close)
      const footerBtns = [fecharBtn]

      if (onImprimir) {
        const btn = el('button', { type: 'button', class: 'btn btn-outline' }, '🖨️ Imprimir')
        btn.addEventListener('click', () => { close(); onImprimir() })
        footerBtns.push(btn)
      }
      if (onRecibo) {
        const btn = el('button', { type: 'button', class: 'btn btn-outline' }, '📄 Recibo')
        btn.addEventListener('click', () => { close(); onRecibo() })
        footerBtns.push(btn)
      }
      if (onEditar) {
        const btn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Editar')
        btn.addEventListener('click', () => { close(); onEditar() })
        footerBtns.push(btn)
      }

      mount(body,
        el('div', { class: 'detalhes-grid' }, ...linhas),
        el('div', { class: 'modal-footer' }, ...footerBtns)
      )
    },
  })
}

// Clique na linha da tabela abre os Detalhes, mas não quando o clique foi em
// um botão/select/input/link dentro dela (ações inline já têm seu próprio
// comportamento — não pode disparar os dois).
export function tornarLinhaClicavel(row, onClick) {
  row.classList.add('row-clicavel')
  row.addEventListener('click', (e) => {
    if (e.target.closest('button, select, input, a, label')) return
    onClick()
  })
}
