// Ícone por forma de pagamento — usado em toda coluna "Pgto" do sistema
// (Pedidos, Vendas, Compras, Financeiro). Forma de pagamento é configurável
// em Configurações (texto livre, ex: "Cartão de Crédito"), não uma chave
// fixa — então o ícone é por palavra-chave dentro do nome, não por igualdade
// exata. Cobre qualquer nome configurado (ex: "Cartão de Débito" também bate
// em "cartão"), com um ícone genérico pra forma que não bater em nada.
const PAG_ICON_RULES = [
  [/pix/i,               '🏦'],
  [/dinheiro|cash/i,      '💰'],
  [/cart[aã]o|cr[eé]dito|d[eé]bito/i, '💳'],
  [/link/i,               '🏪'],
  [/boleto/i,              '📄'],
]

export function iconForForma(nome) {
  return PAG_ICON_RULES.find(([re]) => re.test(nome))?.[1] || '💵'
}

// A partir de uma string já unida ("Pix + Cartão de Crédito", formato salvo
// em Venda/Compra/Financeiro) — separa, converte cada forma pro ícone e
// junta nomes num título (tooltip) legível.
export function iconesFormaPagamento(formaPagamentoStr) {
  const nomes = (formaPagamentoStr || '').split('+').map(s => s.trim()).filter(Boolean)
  return nomes.length ? nomes.map(iconForForma).join(' ') : '—'
}
