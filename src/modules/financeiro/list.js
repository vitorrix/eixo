import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { renderRowActions } from '../../shared/components/RowActions.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { abrirDetalhesModal, tornarLinhaClicavel } from '../../shared/components/DetalhesModal.js'
import { createLancamento, updateLancamento, deleteLancamento, marcarLiquidado } from './service.js'

const TIPO_META = {
  receber: { label: 'Recebimentos', novo: '+ Novo Recebimento', situacaoOk: 'Recebida', contatoLabel: 'Recebido de' },
  pagar:   { label: 'Pagamentos',   novo: '+ Novo Pagamento',    situacaoOk: 'Paga',      contatoLabel: 'Pago para' },
}

const PAG_LABEL = { pix: '🏦 PIX', dinheiro: '💰 Dinheiro', cartao: '💳 Cartão', link: '🏪 Link' }

function nowMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthKey(dataISO) {
  return (dataISO || '').slice(0, 7)
}
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function renderFinanceiroList(container, lancamentos, { operacoes = {}, clientes = [], fornecedores = [] } = {}) {
  const canCreate = can('financeiro', 'create')
  const canEdit   = can('financeiro', 'edit')
  const canDelete = can('financeiro', 'delete')

  const contatoNomes = [...new Set([...clientes.map(c => c.name), ...fornecedores.map(f => f.name)])]
  const contas = operacoes.contas || []
  const formasPagamento = operacoes.formasPagamento || []
  const categorias = operacoes.categorias || []

  let activeTipo = 'receber'
  let currentMonth = nowMonth()

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totalEl  = el('div', { class: 'pedido-stat-value' })
  const valorEl  = el('div', { class: 'pedido-stat-value green' })
  const okEl     = el('div', { class: 'pedido-stat-value' })
  const pendEl   = el('div', { class: 'pedido-stat-value' })

  function updateKpis(list) {
    const meta = TIPO_META[activeTipo]
    const total = list.reduce((s, l) => s + (l.valor || 0), 0)
    const pend  = list.filter(l => !l.liquidado)
    totalEl.textContent = list.length
    valorEl.textContent = brl(total)
    okEl.textContent    = brl(list.filter(l => l.liquidado).reduce((s, l) => s + (l.valor || 0), 0))
    pendEl.textContent  = brl(pend.reduce((s, l) => s + (l.valor || 0), 0))
    pendEl.className    = 'pedido-stat-value ' + (pend.length > 0 ? 'red' : '')
    void meta
  }

  function kpiCard(label, valueEl, sub) {
    return el('div', { class: 'pedido-stat' },
      el('div', { class: 'pedido-stat-label' }, label),
      valueEl,
      el('div', { class: 'pedido-stat-sub' }, sub)
    )
  }

  const kpisRow = el('div', { class: 'pedidos-stats' },
    kpiCard('Lançamentos', totalEl, 'no mês'),
    kpiCard('Total',       valorEl, 'no mês'),
    kpiCard('Liquidado',   okEl,    'no mês'),
    kpiCard('Pendente',    pendEl,  'no mês'),
  )

  // ── Abas Recebimentos / Pagamentos ──────────────────────────────────────
  const tabBtns = Object.entries(TIPO_META).map(([tipo, meta]) => {
    const btn = el('button', { type: 'button', class: 'config-tab-btn' }, meta.label)
    btn.addEventListener('click', () => { activeTipo = tipo; updateTabs(); refresh() })
    return btn
  })
  const tabBar = el('div', { class: 'config-tab-bar' }, ...tabBtns)
  function updateTabs() {
    tabBtns.forEach((btn, i) => btn.classList.toggle('active', Object.keys(TIPO_META)[i] === activeTipo))
  }
  updateTabs()

  // ── Toolbar ───────────────────────────────────────────────────────────────
  const searchInp = el('input', { type: 'text', class: 'search-input', placeholder: 'Buscar por descrição ou contato...' })
  searchInp.addEventListener('input', () => refresh())

  const monthNavLabel = el('span', { class: 'month-nav-label' })
  function monthLabel(ym) {
    const [y, m] = ym.split('-')
    const ms = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${ms[+m - 1]} ${y}`
  }
  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const prevBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '‹')
  const nextBtn = el('button', { type: 'button', class: 'month-nav-btn' }, '›')
  prevBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); refresh() })
  nextBtn.addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, +1); refresh() })

  const newBtn = el('button', { type: 'button', class: 'btn btn-primary' })
  newBtn.style.display = canCreate ? '' : 'none'
  newBtn.addEventListener('click', () => abrirFormModal())

  const countBadge = el('span', { class: 'count-badge' })
  const toolbar = el('div', { class: 'toolbar' },
    el('div', { style: 'display:flex;gap:10px;align-items:center' },
      newBtn,
      el('div', { class: 'month-nav' }, prevBtn, monthNavLabel, nextBtn)
    ),
    countBadge
  )

  // ── Tabela ───────────────────────────────────────────────────────────────
  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Cód'),
        el('th', {}, 'Descrição'),
        el('th', {}, 'Contato'),
        el('th', {}, 'Conta'),
        el('th', {}, 'Data'),
        el('th', {}, 'Situação'),
        el('th', { class: 'th-money' }, 'Valor'),
        ...(canEdit || canDelete ? [el('th', { class: 'col-actions' }, '')] : []),
      )
    ),
    tbody
  )
  const tableWrap  = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state hidden' }, el('p', {}, 'Nenhum lançamento neste mês.'))

  function filteredList() {
    const q = searchInp.value.trim().toLowerCase()
    let list = lancamentos.filter(l => l.tipo === activeTipo && monthKey(l.dataVencimento) === currentMonth)
    if (q) list = list.filter(l =>
      (l.descricao || '').toLowerCase().includes(q) ||
      (l.contato || '').toLowerCase().includes(q)
    )
    return list.sort((a, b) => (a.dataVencimento || '').localeCompare(b.dataVencimento || ''))
  }

  function refresh() {
    newBtn.textContent = TIPO_META[activeTipo].novo
    monthNavLabel.textContent = monthLabel(currentMonth)
    const list = filteredList()
    countBadge.textContent = list.length
    updateKpis(list)
    renderTable(list)
  }

  function situacaoCell(l) {
    const meta = TIPO_META[l.tipo]
    const chk = el('input', { type: 'checkbox', class: 'recibo-chk' })
    chk.checked = !!l.liquidado
    if (!canEdit) chk.disabled = true
    const label = el('label', { class: 'recibo-label' }, chk, el('span', {}, l.liquidado ? meta.situacaoOk : 'Pendente'))
    chk.addEventListener('change', async () => {
      try {
        await marcarLiquidado(l.id, chk.checked)
        label.querySelector('span').textContent = chk.checked ? meta.situacaoOk : 'Pendente'
        toastSuccess('Situação atualizada.')
      } catch {
        toastError('Erro ao atualizar.')
        chk.checked = !chk.checked
      }
    })
    return label
  }

  function renderTable(list) {
    tbody.replaceChildren()
    if (!list.length) {
      tableWrap.classList.add('hidden'); emptyState.classList.remove('hidden'); return
    }
    tableWrap.classList.remove('hidden'); emptyState.classList.add('hidden')

    for (const l of list) {
      const dateStr = l.dataLiquidacao || l.dataVencimento ? shortDate(l.dataLiquidacao || l.dataVencimento) : '—'
      const descricao = l.parcela?.total > 1 ? `${l.descricao} (${l.parcela.numero}/${l.parcela.total})` : l.descricao

      const actionsCell = el('td', { class: 'col-actions' }, renderRowActions({
        canEdit: canEdit && l.origem?.tipo === 'avulso',
        canDelete: canDelete && l.origem?.tipo === 'avulso',
        onEdit: () => abrirFormModal(l),
        onDelete: () => confirmDelete(l),
      }))

      const row = el('tr', {},
        el('td', { class: 'td-date' }, String(l.numero || '—')),
        el('td', { class: 'td-name' }, descricao || '—'),
        el('td', {}, l.contato || '—'),
        el('td', {}, l.conta || '—'),
        el('td', { class: 'td-date' }, dateStr),
        el('td', {}, situacaoCell(l)),
        el('td', { class: 'td-money' }, brl(l.valor || 0)),
        ...(canEdit || canDelete ? [actionsCell] : []),
      )
      tornarLinhaClicavel(row, () => abrirDetalhesLancamentoModal(l))
      tbody.appendChild(row)
    }
  }

  function confirmDelete(l) {
    openConfirm({
      title:        'Excluir lançamento',
      message:      `Excluir "${l.descricao}"${l.contato ? ` de ${l.contato}` : ''}?`,
      confirmLabel: 'Excluir',
      danger:       true,
      onConfirm:    async () => {
        try { await deleteLancamento(l.id); toastSuccess('Lançamento excluído.') }
        catch { toastError('Erro ao excluir.') }
      },
    })
  }

  // ── Detalhes ──────────────────────────────────────────────────────────────
  function abrirDetalhesLancamentoModal(l) {
    const meta = TIPO_META[l.tipo]
    const editavel = l.origem?.tipo === 'avulso'
    abrirDetalhesModal({
      title: `Detalhes do ${l.tipo === 'receber' ? 'Recebimento' : 'Pagamento'}`,
      campos: [
        ['Cód', String(l.numero || '—')],
        ['Descrição', l.descricao],
        [meta.contatoLabel, l.contato],
        ['Valor', brl(l.valor || 0)],
        ['Categoria', l.categoria],
        ['Conta', l.conta],
        ['Forma de pagamento', PAG_LABEL[l.formaPagamento] || l.formaPagamento],
        ['Vencimento', l.dataVencimento ? shortDate(l.dataVencimento) : '—'],
        ['Situação', l.liquidado ? meta.situacaoOk : 'Pendente'],
        l.numeroDocumento ? ['Nº do documento', l.numeroDocumento] : null,
        l.observacoes ? ['Observações', l.observacoes] : null,
        !editavel ? ['Origem', l.origem?.tipo === 'venda' ? 'Gerado automaticamente por uma Venda' : 'Gerado automaticamente por uma Compra'] : null,
      ],
      onEditar: (canEdit && editavel) ? () => abrirFormModal(l) : null,
    })
  }

  // ── Form Novo/Editar ──────────────────────────────────────────────────────
  function abrirFormModal(lancamento) {
    const isEdit = !!lancamento
    const tipo = lancamento?.tipo || activeTipo
    const meta = TIPO_META[tipo]

    openModal({
      title: isEdit ? 'Editar lançamento' : meta.novo,
      size:  'lg',
      renderBody: (body, closeModal) => {
        const descInp = el('input', { type: 'text', placeholder: 'Ex: Conta de luz' })
        descInp.value = lancamento?.descricao || ''

        const valorInp = el('input', { type: 'number', step: '1', min: '0', placeholder: '0' })
        valorInp.value = lancamento?.valor || ''

        const contatoAc = createAutocomplete({
          placeholder:  meta.contatoLabel,
          items:        contatoNomes,
          initialValue: lancamento?.contato || '',
        })
        contatoAc.el.style.width = '100%'

        const categoriaSel = el('select', { class: 'field-select' },
          el('option', { value: '' }, '— Selecione —'),
          ...categorias.filter(c => c.tipo === tipo).map(c => el('option', { value: c.nome }, c.nome))
        )
        categoriaSel.value = lancamento?.categoria || ''

        const contaSel = el('select', { class: 'field-select' },
          el('option', { value: '' }, '— Selecione —'),
          ...contas.map(c => el('option', { value: c }, c))
        )
        contaSel.value = lancamento?.conta || ''

        const formaSel = el('select', { class: 'field-select' },
          el('option', { value: '' }, '— Selecione —'),
          ...formasPagamento.map(f => el('option', { value: f.nome }, f.nome))
        )
        formaSel.value = lancamento?.formaPagamento || ''
        formaSel.addEventListener('change', () => {
          if (!contaSel.value) {
            const forma = formasPagamento.find(f => f.nome === formaSel.value)
            if (forma?.contaPadrao) contaSel.value = forma.contaPadrao
          }
        })

        const vencInp = el('input', { type: 'date' })
        vencInp.value = lancamento?.dataVencimento || todayISO()

        const liquidadoBtnSim = el('button', { type: 'button', class: 'type-btn type-btn-sm' }, 'Sim')
        const liquidadoBtnNao = el('button', { type: 'button', class: 'type-btn type-btn-sm' }, 'Não')
        const liquidadoToggle = el('div', { class: 'type-toggle type-toggle-sm' }, liquidadoBtnNao, liquidadoBtnSim)
        let liquidado = lancamento ? !!lancamento.liquidado : false

        const liquidacaoInp = el('input', { type: 'date' })
        liquidacaoInp.value = lancamento?.dataLiquidacao || todayISO()
        const liquidacaoField = el('div', { class: 'field' },
          el('label', {}, tipo === 'receber' ? 'Data de recebimento' : 'Data de pagamento'), liquidacaoInp)

        function setLiquidado(v) {
          liquidado = v
          liquidadoBtnSim.classList.toggle('active', v)
          liquidadoBtnNao.classList.toggle('active', !v)
          liquidacaoField.style.display = v ? '' : 'none'
        }
        liquidadoBtnSim.addEventListener('click', () => setLiquidado(true))
        liquidadoBtnNao.addEventListener('click', () => setLiquidado(false))
        setLiquidado(liquidado)

        const numDocInp = el('input', { type: 'text' })
        numDocInp.value = lancamento?.numeroDocumento || ''

        const obsInp = el('textarea', { rows: '2', class: 'field-textarea' })
        obsInp.value = lancamento?.observacoes || ''

        // Recorrência — só faz sentido em lançamento novo, não em edição.
        const recBtnSim = el('button', { type: 'button', class: 'type-btn type-btn-sm' }, 'Sim')
        const recBtnNao = el('button', { type: 'button', class: 'type-btn type-btn-sm' }, 'Não')
        const recToggle = el('div', { class: 'type-toggle type-toggle-sm' }, recBtnNao, recBtnSim)
        let recorrente = false

        const diaMesInp = el('input', { type: 'number', min: '1', max: '28', placeholder: 'Ex: 5' })
        const dataIniInp = el('input', { type: 'date' })
        const dataFimInp = el('input', { type: 'date' })
        const recFields = el('div', { class: 'form-grid' },
          el('div', { class: 'field' }, el('label', {}, 'Dia do mês'), diaMesInp),
          el('div', { class: 'field' }, el('label', {}, 'Data inicial'), dataIniInp),
          el('div', { class: 'field' }, el('label', {}, 'Data final'), dataFimInp),
        )
        recFields.style.display = 'none'
        function setRecorrente(v) {
          recorrente = v
          recBtnSim.classList.toggle('active', v)
          recBtnNao.classList.toggle('active', !v)
          recFields.style.display = v ? '' : 'none'
        }
        recBtnSim.addEventListener('click', () => setRecorrente(true))
        recBtnNao.addEventListener('click', () => setRecorrente(false))
        setRecorrente(false)

        const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelBtn.addEventListener('click', closeModal)
        const okBtn = el('button', { type: 'button', class: 'btn btn-primary' }, isEdit ? 'Salvar' : 'Lançar')
        okBtn.addEventListener('click', async () => {
          const descricao = descInp.value.trim()
          if (!descricao) { toastError('Informe a descrição.'); return }
          if (recorrente && (!diaMesInp.value || !dataIniInp.value || !dataFimInp.value)) {
            toastError('Preencha dia do mês, data inicial e data final da recorrência.'); return
          }
          okBtn.disabled = true; okBtn.textContent = 'Salvando...'
          try {
            const payload = {
              tipo, descricao,
              valor:           valorInp.value,
              contato:         contatoAc.getValue(),
              categoria:       categoriaSel.value,
              conta:           contaSel.value,
              formaPagamento:  formaSel.value,
              liquidado,
              dataVencimento:  vencInp.value,
              dataLiquidacao:  liquidacaoInp.value,
              numeroDocumento: numDocInp.value,
              observacoes:     obsInp.value,
            }
            if (isEdit) {
              await updateLancamento(lancamento.id, payload)
              toastSuccess('Lançamento atualizado.')
            } else {
              payload.recorrencia = recorrente
                ? { ativo: true, diaDoMes: Number(diaMesInp.value), dataInicial: dataIniInp.value, dataFinal: dataFimInp.value }
                : null
              await createLancamento(payload)
              toastSuccess(recorrente ? 'Lançamentos recorrentes criados.' : 'Lançamento criado.')
            }
            closeModal()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar.')
            okBtn.disabled = false; okBtn.textContent = isEdit ? 'Salvar' : 'Lançar'
          }
        })

        const camposBase = [
          el('div', { class: 'field field-full' }, el('label', {}, 'Descrição'), descInp),
          el('div', { class: 'field' }, el('label', {}, 'Valor R$'), valorInp),
          el('div', { class: 'field' }, el('label', {}, meta.contatoLabel), contatoAc.el),
          el('div', { class: 'field' }, el('label', {}, 'Categoria'), categoriaSel),
          el('div', { class: 'field' }, el('label', {}, 'Conta'), contaSel),
          el('div', { class: 'field' }, el('label', {}, 'Forma de pagamento'), formaSel),
          el('div', { class: 'field' }, el('label', {}, 'Vencimento'), vencInp),
          el('div', { class: 'field' }, el('label', {}, tipo === 'receber' ? 'Recebido?' : 'Pago?'), liquidadoToggle),
          liquidacaoField,
          el('div', { class: 'field' }, el('label', {}, 'Nº do documento'), numDocInp),
          el('div', { class: 'field field-full' }, el('label', {}, 'Observações'), obsInp),
        ]

        const blocos = [el('div', { class: 'form-grid' }, ...camposBase)]
        if (!isEdit) {
          blocos.push(
            el('div', { class: 'field', style: 'margin-top:8px' }, el('label', {}, 'Recorrente'), recToggle),
            recFields,
          )
        }

        mount(body, ...blocos, el('div', { class: 'modal-footer' }, cancelBtn, okBtn))
      },
    })
  }

  mount(container, kpisRow, tabBar, toolbar, searchInp, tableWrap, emptyState)
  refresh()

  return {
    update(newLancamentos) { lancamentos = newLancamentos; refresh() },
  }
}
