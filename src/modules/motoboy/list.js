import { el, mount } from '../../shared/utils/dom.js'
import { brl, shortDate } from '../../shared/utils/formatters.js'
import { can, isMaster } from '../../auth/session.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toolbarCard } from '../../shared/components/ToolbarCard.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'
import { createAutocomplete } from '../../shared/components/Autocomplete.js'
import { tornarLinhaClicavel } from '../../shared/components/DetalhesModal.js'
import { isoLocal } from '../../shared/utils/periodo.js'
import { createAcerto, deleteAcerto, calcularAcerto, trechosDasEntregasDoDia } from './service.js'

const VALOR_KM_PADRAO = 2.5

// Link do Google Maps já no modo moto (travelmode=two-wheeler) — quem mede o
// km é o Maps; o Eixo só abre o trajeto pronto e recebe o número digitado.
function linkMaps(origem, destino) {
  if (!origem?.trim() || !destino?.trim()) return null
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origem)}&destination=${encodeURIComponent(destino)}&travelmode=two-wheeler`
}

const kmTxt = n => `${String(n).replace('.', ',')} km`
const dataBR = iso => { const [y, m, d] = (iso || '').split('-'); return `${d}/${m}/${y}` }

function resumoTexto(a) {
  const linhas = [`🏍️ *ACERTO MOTOBOY — ${dataBR(a.data)}*`]
  if (a.motoboy) linhas.push(`Motoboy: ${a.motoboy}`)
  linhas.push('')
  a.trechos.forEach((t, i) => {
    const rota = [t.origem, t.destino].filter(Boolean).join(' → ')
    linhas.push(`${i + 1}) ${rota || t.descricao || 'Trecho'} — ${kmTxt(t.km)}`)
  })
  linhas.push('', `Total: ${kmTxt(a.totalKm)} × ${brl(a.valorKm)} = ${brl(a.valorRodado)}`)
  if (a.extras?.length) {
    linhas.push('', 'Extras (pago pelo motoboy):')
    a.extras.forEach(e => linhas.push(`• ${e.descricao || 'Item'} — ${brl(e.valor)}`))
  }
  linhas.push('', `*TOTAL A PAGAR: ${brl(a.total)}*`)
  return linhas.join('\n')
}

export function renderMotoboy(container, acertos, { fornecedores, operacoes }) {
  const canCreate = can('financeiro', 'create')
  const canDelete = isMaster() // exclui também o lançamento, que só o master apaga (firestore.rules)
  let lista = acertos

  const valorKmConfig = parseFloat(operacoes.motoboy?.valorKm) || VALOR_KM_PADRAO
  const nomesMotoboy = () => [...new Set(lista.map(a => a.motoboy).filter(Boolean))]

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Data'), el('th', {}, 'Motoboy'), el('th', {}, 'Trechos'),
      el('th', { class: 'th-money' }, 'Km'), el('th', { class: 'th-money' }, 'Extras'),
      el('th', { class: 'th-money' }, 'Total'), el('th', {}, 'Financeiro'),
    )),
    tbody,
  )
  const tableWrap = el('div', { class: 'table-wrapper' }, table)
  const emptyState = el('div', { class: 'empty-state' },
    el('p', {}, 'Nenhum acerto registrado ainda. Clique em "+ Novo acerto" para fechar o dia do motoboy.'))

  function renderRows() {
    tableWrap.style.display = lista.length ? '' : 'none'
    emptyState.style.display = lista.length ? 'none' : ''
    tbody.replaceChildren(...lista.map(a => {
      const row = el('tr', {},
        el('td', { class: 'td-date' }, shortDate(a.data)),
        el('td', {}, a.motoboy || '—'),
        el('td', {}, String(a.trechos?.length || 0)),
        el('td', { class: 'td-money' }, kmTxt(a.totalKm)),
        el('td', { class: 'td-money' }, a.totalExtras ? brl(a.totalExtras) : '—'),
        el('td', { class: 'td-money' }, brl(a.total)),
        el('td', {}, a.lancamentoNumero ? `#${a.lancamentoNumero}` : '—'),
      )
      tornarLinhaClicavel(row, () => abrirDetalhes(a))
      return row
    }))
  }

  // ── Detalhes ──────────────────────────────────────────────────────────────
  function abrirDetalhes(a) {
    openModal({
      title: `Acerto — ${dataBR(a.data)}${a.motoboy ? ' · ' + a.motoboy : ''}`,
      size: 'lg',
      renderBody: (body, close) => {
        const trechosEl = a.trechos.map((t, i) => el('div', { class: 'detalhes-linha' },
          el('span', { class: 'detalhes-label' }, `Trecho ${i + 1}`),
          el('span', { class: 'detalhes-valor' },
            [[t.origem, t.destino].filter(Boolean).join(' → ') || t.descricao, kmTxt(t.km)].filter(Boolean).join(' — ')),
        ))
        const extrasEl = (a.extras || []).map(e => el('div', { class: 'detalhes-linha' },
          el('span', { class: 'detalhes-label' }, 'Extra'),
          el('span', { class: 'detalhes-valor' }, `${e.descricao || 'Item'} — ${brl(e.valor)}`),
        ))
        const linha = (l, v) => el('div', { class: 'detalhes-linha' },
          el('span', { class: 'detalhes-label' }, l), el('span', { class: 'detalhes-valor' }, v))

        const copiarBtn = el('button', { type: 'button', class: 'btn btn-outline' }, '📋 Copiar resumo')
        copiarBtn.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(resumoTexto(a)); toastSuccess('Resumo copiado.') }
          catch { toastError('Não foi possível copiar.') }
        })
        const fecharBtn = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Fechar')
        fecharBtn.addEventListener('click', close)
        const botoes = [fecharBtn, copiarBtn]

        if (canDelete) {
          const delBtn = el('button', { type: 'button', class: 'btn btn-danger-outline' }, 'Excluir')
          delBtn.addEventListener('click', () => {
            close()
            openConfirm({
              title: 'Excluir acerto',
              message: 'Exclui o acerto e o Pagamento dele no Financeiro. Não pode ser desfeito.',
              confirmLabel: 'Excluir', danger: true,
              onConfirm: async () => {
                try { await deleteAcerto(a.id); toastSuccess('Acerto excluído.') }
                catch { toastError('Erro ao excluir.') }
              },
            })
          })
          botoes.unshift(delBtn)
        }

        mount(body,
          el('div', { class: 'detalhes-grid' },
            ...trechosEl,
            linha('Total de km', kmTxt(a.totalKm)),
            linha(`Km × ${brl(a.valorKm)}`, brl(a.valorRodado)),
            ...extrasEl,
            linha('Total a pagar', brl(a.total)),
            a.lancamentoNumero ? linha('Lançamento no Financeiro', `#${a.lancamentoNumero} (aba Pagamentos)`) : null,
          ),
          el('div', { class: 'modal-footer' }, ...botoes),
        )
      },
    })
  }

  // ── Novo acerto ───────────────────────────────────────────────────────────
  function abrirNovoAcerto() {
    openModal({
      title: '🏍️ Novo acerto do motoboy',
      size: 'lg',
      renderBody: (body, close) => {
        let trechos = [{ origem: '', destino: '', descricao: '', km: '' }]
        let extras = []
        let valorKm = valorKmConfig

        const dataInp = el('input', { type: 'date', class: 'field-input', value: isoLocal(new Date()) })
        const motoAc = createAutocomplete({ placeholder: 'Nome do motoboy', items: nomesMotoboy(), initialValue: nomesMotoboy()[0] || '' })
        const valorKmInp = el('input', { type: 'number', class: 'field-input', step: '0.1', value: String(valorKm) })
        valorKmInp.addEventListener('input', () => { valorKm = parseFloat(valorKmInp.value) || 0; atualizarResumo() })

        const contas = operacoes.contas || []
        const contaSel = el('select', { class: 'field-select' },
          el('option', { value: '' }, 'Conta (opcional)'),
          ...contas.map(c => el('option', { value: c }, c)))
        const pagoChk = el('input', { type: 'checkbox' })

        const trechosWrap = el('div', { class: 'motoboy-trechos' })
        const extrasWrap = el('div', { class: 'motoboy-trechos' })
        const resumoEl = el('div', { class: 'motoboy-resumo' })
        const importMsg = el('p', { class: 'motoboy-msg' })

        function atualizarResumo() {
          const t = calcularAcerto({ trechos, extras, valorKm })
          resumoEl.replaceChildren(
            el('div', {}, el('span', {}, 'Total de km'), el('strong', {}, kmTxt(t.totalKm))),
            el('div', {}, el('span', {}, `Km × ${brl(valorKm)}`), el('strong', {}, brl(t.valorRodado))),
            el('div', {}, el('span', {}, 'Extras'), el('strong', {}, brl(t.totalExtras))),
            el('div', { class: 'motoboy-resumo-total' }, el('span', {}, 'TOTAL A PAGAR'), el('strong', {}, brl(t.total))),
          )
        }

        function campo(valor, placeholder, onInput, extra = {}) {
          const i = el('input', { type: 'text', class: 'field-input', placeholder, ...extra })
          i.value = valor || ''
          i.addEventListener('input', () => { onInput(i.value); })
          return i
        }

        function renderTrechos() {
          trechosWrap.replaceChildren(...trechos.map((t, i) => {
            const kmInp = el('input', { type: 'number', class: 'field-input motoboy-km', step: '0.1', min: '0', placeholder: '0,0' })
            kmInp.value = t.km
            kmInp.addEventListener('input', () => { t.km = kmInp.value; atualizarResumo() })

            const mapsBtn = el('a', { class: 'btn btn-sm btn-outline', target: '_blank', rel: 'noopener', title: 'Abrir o trajeto no Google Maps (moto)' }, '🗺️ Ver no Maps')
            const atualizarMaps = () => {
              const l = linkMaps(t.origem, t.destino)
              if (l) { mapsBtn.href = l; mapsBtn.classList.remove('disabled') }
              else { mapsBtn.removeAttribute('href'); mapsBtn.classList.add('disabled') }
            }
            atualizarMaps()

            const remover = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
            remover.addEventListener('click', () => { trechos.splice(i, 1); renderTrechos(); atualizarResumo() })

            const linhaEndereco = (rotulo, valor, placeholder, onInput) => el('div', { class: 'motoboy-linha' },
              el('span', { class: 'motoboy-rotulo' }, rotulo),
              campo(valor, placeholder, onInput),
            )

            return el('div', { class: 'motoboy-trecho' },
              el('div', { class: 'motoboy-trecho-head' },
                el('span', { class: 'motoboy-trecho-num' }, `Trecho ${i + 1}`),
                t.descricao ? el('span', { class: 'motoboy-trecho-desc' }, t.descricao) : null,
                remover,
              ),
              linhaEndereco('↑ Retirada', t.origem, 'Endereço ou nome da loja', v => { t.origem = v; atualizarMaps() }),
              linhaEndereco('↓ Entrega', t.destino, 'Endereço de entrega', v => { t.destino = v; atualizarMaps() }),
              el('div', { class: 'motoboy-trecho-rodape' },
                mapsBtn,
                el('div', { class: 'motoboy-km-wrap' }, kmInp, el('span', {}, 'km')),
              ),
            )
          }))
        }

        function renderExtras() {
          extrasWrap.replaceChildren(...extras.map((e, i) => {
            const valInp = el('input', { type: 'number', class: 'field-input motoboy-km', step: '0.01', min: '0', placeholder: 'R$ 0,00' })
            valInp.value = e.valor
            valInp.addEventListener('input', () => { e.valor = valInp.value; atualizarResumo() })
            const remover = el('button', { type: 'button', class: 'btn btn-sm btn-danger-outline' }, '×')
            remover.addEventListener('click', () => { extras.splice(i, 1); renderExtras(); atualizarResumo() })
            return el('div', { class: 'motoboy-trecho-campos' },
              campo(e.descricao, 'Ex: Película 3D paga no fornecedor', v => { e.descricao = v }),
              valInp, remover)
          }))
        }

        const addTrecho = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar trecho')
        addTrecho.addEventListener('click', () => { trechos.push({ origem: '', destino: '', descricao: '', km: '' }); renderTrechos() })

        const addExtra = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '+ Adicionar extra (acessório pago etc.)')
        addExtra.addEventListener('click', () => { extras.push({ descricao: '', valor: '' }); renderExtras() })

        const importBtn = el('button', { type: 'button', class: 'btn btn-outline btn-sm' }, '⬇ Importar entregas do dia')
        importBtn.addEventListener('click', async () => {
          importBtn.disabled = true
          importMsg.textContent = 'Buscando...'
          try {
            const r = await trechosDasEntregasDoDia(dataInp.value, fornecedores)
            const jaTem = new Set(trechos.map(t => t.pedidoId).filter(Boolean))
            const novos = r.trechos.filter(t => !jaTem.has(t.pedidoId))
            // Trecho em branco inicial some quando entram os importados
            if (novos.length && trechos.length === 1 && !trechos[0].origem && !trechos[0].destino && !trechos[0].km) trechos = []
            trechos.push(...novos)
            renderTrechos(); atualizarResumo()
            importMsg.textContent = r.entregas
              ? `${novos.length} trecho(s) importado(s) de ${r.entregas} entrega(s) do dia${r.semRoteiro ? ` — ${r.semRoteiro} sem roteiro salvo` : ''}.`
              : 'Nenhuma entrega concluída nesse dia.'
          } catch (err) {
            console.error(err)
            importMsg.textContent = 'Erro ao buscar as entregas.'
          } finally { importBtn.disabled = false }
        })

        renderTrechos(); renderExtras(); atualizarResumo()

        const cancelar = el('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar')
        cancelar.addEventListener('click', close)
        const salvar = el('button', { type: 'button', class: 'btn btn-primary' }, 'Salvar acerto')
        salvar.addEventListener('click', async () => {
          const t = calcularAcerto({ trechos, extras, valorKm })
          if (!dataInp.value) return toastError('Informe a data.')
          if (!motoAc.getValue().trim()) return toastError('Informe o nome do motoboy.')
          if (t.total <= 0) return toastError('Informe o km dos trechos ou algum extra.')
          if (trechos.some(x => (parseFloat(x.km) || 0) <= 0 && (x.origem || x.destino))) {
            return toastError('Tem trecho sem km — preencha ou remova.')
          }
          const categoria = (operacoes.categorias || []).find(c => c.tipo === 'pagar' && /motoboy/i.test(c.nome))?.nome
            || (operacoes.categorias || []).find(c => c.tipo === 'pagar' && /frete/i.test(c.nome))?.nome || ''
          salvar.disabled = true; salvar.textContent = 'Salvando...'
          try {
            await createAcerto(
              { data: dataInp.value, motoboy: motoAc.getValue(), valorKm, trechos: trechos.filter(x => (parseFloat(x.km) || 0) > 0), extras },
              { liquidado: pagoChk.checked, conta: contaSel.value, categoria },
            )
            toastSuccess('Acerto salvo e lançado no Financeiro (Pagamentos).')
            close()
          } catch (err) {
            console.error(err)
            toastError('Erro ao salvar o acerto.')
            salvar.disabled = false; salvar.textContent = 'Salvar acerto'
          }
        })

        mount(body,
          el('div', { class: 'motoboy-topo' },
            el('div', { class: 'field' }, el('label', {}, 'Data'), dataInp),
            el('div', { class: 'field' }, el('label', {}, 'Motoboy'), motoAc.el),
            el('div', { class: 'field' }, el('label', {}, 'Valor por km (R$)'), valorKmInp),
          ),
          el('div', { class: 'motoboy-secao-head' },
            el('h4', {}, 'Trechos (retirada → entrega)'),
            importBtn),
          importMsg,
          trechosWrap, addTrecho,
          el('div', { class: 'motoboy-secao-head', style: 'margin-top:22px' }, el('h4', {}, 'Extras (pagos pelo motoboy)')),
          extrasWrap, addExtra,
          resumoEl,
          el('div', { class: 'motoboy-pagamento' },
            el('label', { class: 'checkbox-pill' }, pagoChk, el('span', {}, ' Já foi pago')),
            contaSel,
          ),
          el('div', { class: 'modal-footer' }, cancelar, salvar),
        )
      },
    })
  }

  const novoBtn = el('button', { type: 'button', class: 'btn btn-primary' }, '+ Novo acerto')
  novoBtn.style.display = canCreate ? '' : 'none'
  novoBtn.addEventListener('click', abrirNovoAcerto)

  mount(container,
    toolbarCard(novoBtn, el('span', { class: 'text-muted', style: 'font-size:13px' },
      `Valor por km padrão: ${brl(valorKmConfig)} (Configurações → Motoboy)`)),
    tableWrap, emptyState,
  )
  renderRows()

  return { update(novos) { lista = novos; renderRows() } }
}

