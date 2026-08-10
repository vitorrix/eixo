// Nome de cliente/fornecedor "vivo" — resolve pelo id salvo no documento
// contra a lista atual do cadastro, em vez de usar só o texto copiado na
// hora da criação (que ficava desatualizado quando alguém editava o nome
// depois). Registro sem id salvo (lançado antes dessa mudança) ou cujo
// cadastro foi excluído cai de volta pro texto congelado.
// getLabel deixa customizar o texto (ex: fornecedor mostra "Nome - Box").
export function buildNomeMap(lista, getLabel = e => e.name) {
  return new Map((lista || []).map(e => [e.id, getLabel(e)]))
}

export function nomeVivo(id, textoSalvo, mapa) {
  return (id && mapa.get(id)) || textoSalvo || ''
}
