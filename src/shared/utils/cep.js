export async function buscarCEP(cep) {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) throw new Error('CEP deve ter 8 dígitos.')

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!res.ok) throw new Error('Falha ao consultar o CEP.')

  const data = await res.json()
  if (data.erro) throw new Error('CEP não encontrado.')

  return {
    logradouro:  data.logradouro  || '',
    bairro:      data.bairro      || '',
    cidade:      data.localidade  || '',
    estado:      data.uf          || '',
  }
}
