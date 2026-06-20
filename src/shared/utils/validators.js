export function validateCPF(raw) {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem >= 10) rem = 0
  if (rem !== parseInt(d[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem >= 10) rem = 0
  return rem === parseInt(d[10])
}

export function validateCNPJ(raw) {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (str, n) => {
    let sum = 0, pos = n - 7
    for (let i = n; i >= 1; i--) {
      sum += parseInt(str[n - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13])
}

export function validateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function validatePhone(raw) {
  const d = raw.replace(/\D/g, '')
  return d.length >= 10 && d.length <= 11
}
