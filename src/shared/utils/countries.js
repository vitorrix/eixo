// Lista de países usada no seletor de telefone internacional (cadastro de fornecedores).
// `length` é a quantidade típica de dígitos do número local (sem o código do país).
export const COUNTRIES = [
  { iso: 'BR', name: 'Brasil',                 flag: '🇧🇷', dial: '55',  length: 11 },
  { iso: 'US', name: 'Estados Unidos',         flag: '🇺🇸', dial: '1',   length: 10 },
  { iso: 'PY', name: 'Paraguai',                flag: '🇵🇾', dial: '595', length: 9  },
  { iso: 'AR', name: 'Argentina',               flag: '🇦🇷', dial: '54',  length: 10 },
  { iso: 'CL', name: 'Chile',                   flag: '🇨🇱', dial: '56',  length: 9  },
  { iso: 'UY', name: 'Uruguai',                 flag: '🇺🇾', dial: '598', length: 8  },
  { iso: 'CN', name: 'China',                   flag: '🇨🇳', dial: '86',  length: 11 },
  { iso: 'HK', name: 'Hong Kong',                flag: '🇭🇰', dial: '852', length: 8  },
  { iso: 'AE', name: 'Emirados Árabes Unidos',  flag: '🇦🇪', dial: '971', length: 9  },
  { iso: 'LB', name: 'Líbano',                  flag: '🇱🇧', dial: '961', length: 8  },
  { iso: 'PT', name: 'Portugal',                flag: '🇵🇹', dial: '351', length: 9  },
  { iso: 'MX', name: 'México',                  flag: '🇲🇽', dial: '52',  length: 10 },
  { iso: 'CO', name: 'Colômbia',                flag: '🇨🇴', dial: '57',  length: 10 },
  { iso: 'PE', name: 'Peru',                    flag: '🇵🇪', dial: '51',  length: 9  },
  { iso: 'BO', name: 'Bolívia',                 flag: '🇧🇴', dial: '591', length: 8  },
  { iso: 'GB', name: 'Reino Unido',             flag: '🇬🇧', dial: '44',  length: 10 },
  { iso: 'ES', name: 'Espanha',                 flag: '🇪🇸', dial: '34',  length: 9  },
  { iso: 'IT', name: 'Itália',                  flag: '🇮🇹', dial: '39',  length: 10 },
  { iso: 'JP', name: 'Japão',                   flag: '🇯🇵', dial: '81',  length: 10 },
  { iso: 'KR', name: 'Coreia do Sul',           flag: '🇰🇷', dial: '82',  length: 10 },
  { iso: 'CA', name: 'Canadá',                  flag: '🇨🇦', dial: '1',   length: 10 },
  { iso: 'DE', name: 'Alemanha',                flag: '🇩🇪', dial: '49',  length: 11 },
  { iso: 'FR', name: 'França',                  flag: '🇫🇷', dial: '33',  length: 9  },
]

export const DEFAULT_COUNTRY = COUNTRIES[0] // Brasil

export function findCountryByDial(dial) {
  return COUNTRIES.find(c => c.dial === dial) || DEFAULT_COUNTRY
}

// Mantém a máscara brasileira original — (XX) XXXXX-XXXX — para não quebrar dados existentes.
function maskBR(v) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// Para os demais países, agrupa em blocos de 3 dígitos — não há um padrão único confiável.
function maskGeneric(v, length) {
  const d = v.replace(/\D/g, '').slice(0, length)
  return d.replace(/(\d{3})(?=\d)/g, '$1 ')
}

export function maskPhoneForCountry(v, country = DEFAULT_COUNTRY) {
  return country.dial === '55' ? maskBR(v) : maskGeneric(v, country.length)
}

export function validatePhoneForCountry(raw, country = DEFAULT_COUNTRY) {
  const d = raw.replace(/\D/g, '')
  if (country.dial === '55') return d.length >= 10 && d.length <= 11
  return d.length >= country.length - 1 && d.length <= country.length
}

export function phonePlaceholderForCountry(country = DEFAULT_COUNTRY) {
  return country.dial === '55' ? '(00) 00000-0000' : '0'.repeat(country.length)
}
