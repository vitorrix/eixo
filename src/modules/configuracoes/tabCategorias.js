import { el, mount } from '../../shared/utils/dom.js'
import { saveOperacoes } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

// Grupo que a categoria cai no DRE (Receita bruta, CMV, Despesas...) — usado
// só como agrupamento de relatório, não afeta o fluxo de lançamento em si.
export const GRUPOS_DRE = [
  'Receita bruta',
  'Custo dos produtos (CMV)',
  'Despesas operacionais',
  'Despesas de vendas',
  'Despesas diversas',
]

// Sugestão inicial pra quem ainda não configurou nada — só aparece na tela até
// salvar, não é gravado sozinho no banco.
const SUGESTAO_INICIAL = [
  { nome: 'Venda de produtos/serviços', tipo: 'receber', grupoDRE: 'Receita bruta' },
  { nome: 'Custo de produtos (compra)', tipo: 'pagar',   grupoDRE: 'Custo dos produtos (CMV)' },
  { nome: 'Frete/Motoboy',              tipo: 'pagar',   grupoDRE: 'Despesas de vendas' },
  { nome: 'Folha de pagamento',         tipo: 'pagar',   grupoDRE: 'Despesas operacionais' },
  { nome: 'Contas fixas',               tipo: 'pagar',   grupoDRE: 'Despesas operacionais' },
  { nome: 'Outros',                     tipo: 'pagar',   grupoDRE: 'Despesas diversas' },
]

export function renderTabCategorias(container, operacoes, onSaved) {
  let categorias = (operacoes.categorias?.length ? operacoes.categorias : SUGESTAO_INICIAL).map(c => ({ ...c }))

  const listEl = el('div', { class: 'config-list' })

  function renderList() {
    listEl.replaceChildren()
    if (!categorias.length) {
      listEl.appendChild(el('p', { class: 'text-muted' }, 'Nenhuma categoria cadastrada.'))
      return
    }
    categorias.forEach((c, i) => {
      const nomeInp = el('input', { type: 'text', placeholder: 'Ex: Frete/Motoboy' })
      nomeInp.value = c.nome || ''
      nomeInp.addEventListener('input', () => { categorias[i].nome = nomeInp.value })

      const tipoSel = el('select', { class: 'field-select' },
        el('option', { value: 'receber' }, 'Receber'),
        el('option', { value: 'pagar' }, 'Pagar'),
      )
      tipoSel.value = c.tipo || 'pagar'
      tipoSel.addEventListener('change', () => { categorias[i].tipo = tipoSel.value })

      const grupoSel = el('select', { class: 'field-select' },
        ...GRUPOS_DRE.map(g => el('option', { value: g }, g))
      )
      grupoSel.value = c.grupoDRE || GRUPOS_DRE[0]
      grupoSel.addEventListener('change', () => { categorias[i].grupoDRE = grupoSel.value })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => { categorias.splice(i, 1); renderList() })

      listEl.appendChild(el('div', { class: 'config-list-item config-list-item--categoria' }, nomeInp, tipoSel, grupoSel, delBtn))
    })
  }

  renderList()

  const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar categoria')
  addBtn.addEventListener('click', () => { categorias.push({ nome: '', tipo: 'pagar', grupoDRE: GRUPOS_DRE[0] }); renderList() })

  const saveBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar categorias')
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'
    try {
      const updated = { ...operacoes, categorias }
      await saveOperacoes(updated)
      onSaved(updated)
      toastSuccess('Categorias salvas.')
    } catch (err) {
      console.error(err)
      toastError('Erro ao salvar.')
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Salvar categorias'
    }
  })

  mount(container,
    el('div', { class: 'config-section' },
      el('p', { class: 'config-section-title' }, 'Categorias Financeiras'),
      el('p', { class: 'text-muted', style: 'font-size:13px;margin-bottom:10px' },
        'Usadas nos lançamentos de Recebimento/Pagamento e, mais pra frente, no DRE.'),
      el('div', { class: 'config-list-header' },
        el('span', {}, 'Nome'),
        el('span', {}, 'Tipo'),
        el('span', {}, 'Grupo no DRE'),
        el('span', {})
      ),
      listEl,
      addBtn
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
