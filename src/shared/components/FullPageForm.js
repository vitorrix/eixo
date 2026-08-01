import { el, mount } from '../utils/dom.js'

// Alterna entre a lista de um módulo e um formulário em página cheia (em vez
// de modal) — mesmo padrão do "Nova Venda" do eGestor: some a lista, o
// formulário ocupa o espaço todo, "← Voltar" ou Esc devolve pra lista sem
// recriar nada (o estado da lista — filtro, mês, ordenação — continua vivo).
//
// Uso:
//   const pageSwitch = createFullPageSwitcher(container)
//   mount(pageSwitch.listWrap, kpisRow, toolbar, tableWrap, ...)
//   function abrirFormulario(item) {
//     pageSwitch.showForm(item ? 'Editar X' : 'Novo X',
//       (body, close) => renderXForm(body, close, item, {...}))
//   }
export function createFullPageSwitcher(container) {
  const listWrap = el('div', {})
  const formWrap = el('div', { class: 'hidden' })
  let onEsc = null

  function showList() {
    if (onEsc) { document.removeEventListener('keydown', onEsc); onEsc = null }
    formWrap.replaceChildren()
    formWrap.classList.add('hidden')
    listWrap.classList.remove('hidden')
  }

  function showForm(title, renderBody) {
    listWrap.classList.add('hidden')
    formWrap.classList.remove('hidden')
    formWrap.replaceChildren()

    const backBtn = el('button', { type: 'button', class: 'btn btn-ghost fullpage-back-btn' }, '← Voltar')
    backBtn.addEventListener('click', showList)
    const header = el('div', { class: 'page-header fullpage-header' }, backBtn, el('h2', {}, title))
    const bodyWrap = el('div', { class: 'fullpage-form-body' })
    mount(formWrap, header, bodyWrap)

    onEsc = e => { if (e.key === 'Escape') showList() }
    document.addEventListener('keydown', onEsc)

    renderBody(bodyWrap, showList)
  }

  mount(container, listWrap, formWrap)
  return { listWrap, formWrap, showForm, showList }
}
