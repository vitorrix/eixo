import { el, mount } from '../../shared/utils/dom.js'
import { saveOperacoes } from './service.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

// Grupo que a categoria cai no DRE — estrutura fixa em 5 blocos (Receita,
// Impostos, CMV, Despesas Operacionais, Despesas de Vendas, Resultado
// Financeiro). Só Despesas Operacionais tem subgrupo; nos demais fica null.
// Empréstimos e rendimentos financeiros ficam em Resultado Financeiro,
// separado do operacional — é o que corrige a distorção do DRE antigo, que
// misturava parcela de empréstimo em despesa operacional fixa.
export const GRUPOS_DRE = [
  { grupo: 'Receita Bruta' },
  { grupo: 'Impostos' },
  { grupo: 'Custo dos Produtos Vendidos (CMV)' },
  { grupo: 'Despesas Operacionais', subgrupos: ['Pessoal', 'Logística & Transporte', 'Marketing & Tráfego', 'Administrativo'] },
  { grupo: 'Despesas de Vendas' },
  { grupo: 'Resultado Financeiro' },
]

function subgruposDoGrupo(grupoNome) {
  return GRUPOS_DRE.find(g => g.grupo === grupoNome)?.subgrupos || null
}

// Sugestão inicial pra quem ainda não configurou nada — só aparece na tela até
// salvar, não é gravado sozinho no banco.
const SUGESTAO_INICIAL = [
  { nome: 'Venda de produtos/serviços', tipo: 'receber', grupo: 'Receita Bruta', subgrupo: null },
  { nome: 'Custo de produtos (compra)', tipo: 'pagar',   grupo: 'Custo dos Produtos Vendidos (CMV)', subgrupo: null },
  { nome: 'Frete/Motoboy',              tipo: 'pagar',   grupo: 'Despesas de Vendas', subgrupo: null },
  { nome: 'Folha de pagamento',         tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Pessoal' },
  { nome: 'Contas fixas',               tipo: 'pagar',   grupo: 'Despesas Operacionais', subgrupo: 'Administrativo' },
  { nome: 'Outros',                     tipo: 'pagar',   grupo: 'Despesas de Vendas', subgrupo: null },
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
        ...GRUPOS_DRE.map(g => el('option', { value: g.grupo }, g.grupo))
      )
      grupoSel.value = c.grupo || GRUPOS_DRE[0].grupo

      const subgrupoSel = el('select', { class: 'field-select' })
      function renderSubgrupoOptions() {
        const subgrupos = subgruposDoGrupo(grupoSel.value)
        subgrupoSel.replaceChildren()
        if (!subgrupos) {
          subgrupoSel.appendChild(el('option', { value: '' }, '—'))
          subgrupoSel.value = ''
          subgrupoSel.disabled = true
          categorias[i].subgrupo = null
          return
        }
        subgrupoSel.disabled = false
        subgrupos.forEach(s => subgrupoSel.appendChild(el('option', { value: s }, s)))
        subgrupoSel.value = subgrupos.includes(c.subgrupo) ? c.subgrupo : subgrupos[0]
        categorias[i].subgrupo = subgrupoSel.value
      }
      renderSubgrupoOptions()

      grupoSel.addEventListener('change', () => {
        categorias[i].grupo = grupoSel.value
        renderSubgrupoOptions()
      })
      subgrupoSel.addEventListener('change', () => { categorias[i].subgrupo = subgrupoSel.value })

      const delBtn = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
      delBtn.addEventListener('click', () => { categorias.splice(i, 1); renderList() })

      listEl.appendChild(el('div', { class: 'config-list-item config-list-item--categoria' }, nomeInp, tipoSel, grupoSel, subgrupoSel, delBtn))
    })
  }

  renderList()

  const addBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar categoria')
  addBtn.addEventListener('click', () => { categorias.push({ nome: '', tipo: 'pagar', grupo: GRUPOS_DRE[0].grupo, subgrupo: null }); renderList() })

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
        'Usadas nos lançamentos de Recebimento/Pagamento e no relatório de DRE.'),
      el('div', { class: 'config-list-header' },
        el('span', {}, 'Nome'),
        el('span', {}, 'Tipo'),
        el('span', {}, 'Grupo no DRE'),
        el('span', {}, 'Subgrupo'),
        el('span', {})
      ),
      listEl,
      addBtn
    ),
    el('div', { class: 'config-actions' }, saveBtn)
  )
}
