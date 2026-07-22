import { monthKey } from '../../shared/utils/month.js'
import { toNumero } from '../../shared/utils/formatters.js'

// Regime de caixa: só entra o que já foi liquidado (recebido/pago de fato) no
// mês selecionado, pela data de liquidação — não pela data de vencimento.
// Usado pelo Fluxo de Caixa Periódico, que agrupa por mês.
export function lancamentosDoMes(lancamentos, mes) {
  return lancamentos.filter(l => l.liquidado && monthKey(l.dataLiquidacao) === mes)
}

// Mesma regra de caixa, mas para um intervalo de datas [de, ate] inclusive —
// usado pelos relatórios com filtro de período (DRE, Fluxo Financeiro).
export function lancamentosNoPeriodo(lancamentos, de, ate) {
  return lancamentos.filter(l =>
    l.liquidado && l.dataLiquidacao && l.dataLiquidacao >= de && l.dataLiquidacao <= ate
  )
}

export function somaCategoria(lancamentosMes, categoria) {
  return lancamentosMes
    .filter(l => l.categoria === categoria.nome && l.tipo === categoria.tipo)
    .reduce((s, l) => s + toNumero(l.valor), 0)
}

export function categoriasDoGrupo(categorias, grupo, subgrupo) {
  return categorias.filter(c => c.grupo === grupo && (subgrupo ? c.subgrupo === subgrupo : true))
}

// Soma de todas as categorias de um grupo (ou de um subgrupo específico
// dentro de Despesas Operacionais), ignorando o sinal — quem decide se soma
// ou subtrai é quem chama, conforme o relatório.
export function totalGrupo(lancamentosMes, categorias, grupo, subgrupo) {
  return categoriasDoGrupo(categorias, grupo, subgrupo)
    .reduce((s, c) => s + somaCategoria(lancamentosMes, c), 0)
}
