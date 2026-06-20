import { login } from '../auth/session.js'
import { initRouter } from '../router/index.js'
import { el, mount } from '../shared/utils/dom.js'

export function renderLogin(container) {
  const form = el('form', { class: 'login-form', id: 'login-form' })

  const logoImg = el('img', {
    src: `${import.meta.env.BASE_URL}logo.png`,
    alt: 'EIXO — Plataforma Baruk',
    class: 'login-logo-img',
  })

  const logo = el('div', { class: 'login-logo' }, logoImg)

  const fieldEmail = el('div', { class: 'field' },
    el('label', { for: 'email' }, 'E-mail'),
    el('input', { type: 'email', id: 'email', name: 'email', required: '', autocomplete: 'email' })
  )

  const fieldPassword = el('div', { class: 'field' },
    el('label', { for: 'password' }, 'Senha'),
    el('input', { type: 'password', id: 'password', name: 'password', required: '', autocomplete: 'current-password' })
  )

  const errorMsg = el('p', { class: 'login-error hidden', id: 'login-error' })

  const submitBtn = el('button', { type: 'submit', class: 'btn btn-primary btn-full' }, 'Entrar')

  form.append(logo, fieldEmail, fieldPassword, errorMsg, submitBtn)

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Entrando...'
    errorMsg.classList.add('hidden')

    const email = form.elements['email'].value.trim()
    const password = form.elements['password'].value

    try {
      await login(email, password)
      initRouter()
    } catch (err) {
      errorMsg.textContent = friendlyError(err.code || err.message)
      errorMsg.classList.remove('hidden')
      submitBtn.disabled = false
      submitBtn.textContent = 'Entrar'
    }
  })

  const wrapper = el('div', { class: 'login-wrapper' }, form)
  mount(container, wrapper)
}

function friendlyError(code) {
  const map = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-disabled': 'Usuário desativado. Contate o administrador.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
  }
  return map[code] ?? 'Erro ao entrar. Tente novamente.'
}
