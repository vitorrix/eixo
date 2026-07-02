const VALIDADE_DIAS = 90
const ALERTA_DIAS_ANTES = 15

// Retorna { status: 'ok' | 'warn' | 'expired' | 'never', dueDate: Date|null, daysLeft: number|null }
export function validationStatus(lastValidatedAt) {
  const validatedDate = lastValidatedAt?.toDate ? lastValidatedAt.toDate() : null
  if (!validatedDate) return { status: 'never', dueDate: null, daysLeft: null }

  const dueDate = new Date(validatedDate)
  dueDate.setDate(dueDate.getDate() + VALIDADE_DIAS)

  const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) return { status: 'expired', dueDate, daysLeft }
  if (daysLeft <= ALERTA_DIAS_ANTES) return { status: 'warn', dueDate, daysLeft }
  return { status: 'ok', dueDate, daysLeft }
}

export const VALIDATION_LABELS = {
  ok:      'Validado',
  warn:    'Revalidar em breve',
  expired: 'Validação vencida',
  never:   'Nunca validado',
}
