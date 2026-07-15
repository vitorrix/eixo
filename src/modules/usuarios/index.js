import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfig } from '../../firebase.js'
import { isMaster } from '../../auth/session.js'
import { el, mount } from '../../shared/utils/dom.js'
import { openModal, openConfirm } from '../../shared/components/Modal.js'
import { toastSuccess, toastError } from '../../shared/components/Toast.js'

const MODULES = [
  { key: 'pedidos',      label: 'Pedidos' },
  { key: 'compras',      label: 'Compras' },
  { key: 'vendas',       label: 'Vendas' },
  { key: 'clientes',     label: 'Clientes' },
  { key: 'fornecedores', label: 'Fornecedores' },
  { key: 'produtos',     label: 'Produtos' },
  { key: 'orcamentos',   label: 'Orçamentos' },
  { key: 'busca',        label: 'Busca' },
  { key: 'financeiro',   label: 'Financeiro' },
]
const ACTIONS = [
  { key: 'view',   label: 'Ver' },
  { key: 'create', label: 'Criar' },
  { key: 'edit',   label: 'Editar' },
  { key: 'delete', label: 'Excluir' },
]

async function createEmployee(name, email, password, permissions) {
  const tempApp = initializeApp(firebaseConfig, `eixo-create-${Date.now()}`)
  const tempAuth = getAuth(tempApp)
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      role: 'employee',
      permissions,
      active: true,
      createdAt: serverTimestamp(),
    })
    return cred.user.uid
  } finally {
    await deleteApp(tempApp)
  }
}

function buildPermissionsSection(initialPermissions = {}) {
  const state = {}
  const grid = el('div', { class: 'perms-grid' })

  for (const mod of MODULES) {
    state[mod.key] = {}
    const actionsDiv = el('div', { class: 'perms-actions' })
    const modInitial = initialPermissions[mod.key] || {}

    for (const action of ACTIONS) {
      const checked = !!modInitial[action.key]
      state[mod.key][action.key] = checked
      const cb = el('input', { type: 'checkbox', id: `perm-${mod.key}-${action.key}`, ...(checked ? { checked: '' } : {}) })
      cb.addEventListener('change', () => { state[mod.key][action.key] = cb.checked })
      const lbl = el('label', { for: `perm-${mod.key}-${action.key}`, class: 'perm-label' })
      lbl.append(cb, action.label)
      actionsDiv.appendChild(lbl)
    }

    // "Tudo" shortcut
    const allChecked = ACTIONS.every(action => state[mod.key][action.key])
    const allCb = el('input', { type: 'checkbox', id: `perm-${mod.key}-all`, ...(allChecked ? { checked: '' } : {}) })
    allCb.addEventListener('change', () => {
      const checked = allCb.checked
      for (const action of ACTIONS) {
        state[mod.key][action.key] = checked
        const cb = document.getElementById(`perm-${mod.key}-${action.key}`)
        if (cb) cb.checked = checked
      }
    })
    const allLbl = el('label', { for: `perm-${mod.key}-all`, class: 'perm-label perm-label--all' })
    allLbl.append(allCb, 'Tudo')

    const row = el('div', { class: 'perms-row' },
      el('span', { class: 'perms-module-label' }, mod.label),
      allLbl,
      el('span', { class: 'perms-divider' }, '|'),
      actionsDiv,
    )
    grid.appendChild(row)
  }

  return { el: grid, getState: () => state }
}

function openUserForm() {
  const nameInput = el('input', { type: 'text',     class: 'field-input', placeholder: 'Nome completo' })
  const emailInput = el('input', { type: 'email',   class: 'field-input', placeholder: 'email@exemplo.com' })
  const passInput  = el('input', { type: 'password', class: 'field-input', placeholder: 'Mínimo 6 caracteres' })

  openModal({
    title: 'Novo Usuário',
    size: 'md',
    renderBody: (body, close) => {
      const { el: permsEl, getState } = buildPermissionsSection()

      mount(body,
        el('div', { class: 'field' }, el('label', {}, 'Nome'), nameInput),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'E-mail'), emailInput),
        el('div', { class: 'field', style: 'margin-top:14px' }, el('label', {}, 'Senha provisória'), passInput),
        el('div', { class: 'field', style: 'margin-top:18px' },
          el('label', {}, 'Permissões de acesso'),
          permsEl
        ),
      )

      // Guarda a referência do getState para o footer poder acessar
      body._getState = getState
      body._close = close
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, 'Cadastrar')

      cancelBtn.addEventListener('click', close)

      saveBtn.addEventListener('click', async () => {
        const name  = nameInput.value.trim()
        const email = emailInput.value.trim()
        const pass  = passInput.value

        if (!name)           return toastError('Informe o nome da funcionária')
        if (!email)          return toastError('Informe o e-mail')
        if (pass.length < 6) return toastError('A senha deve ter ao menos 6 caracteres')

        const body = document.querySelector('.modal-body')
        const permissions = body?._getState?.() ?? {}

        saveBtn.disabled = true
        saveBtn.textContent = 'Cadastrando...'
        try {
          await createEmployee(name, email, pass, permissions)
          toastSuccess(`${name} cadastrada com sucesso!`)
          close()
        } catch (err) {
          const msg = err.code === 'auth/email-already-in-use'
            ? 'Este e-mail já está em uso.'
            : (err.message || 'Erro ao cadastrar')
          toastError(msg)
          saveBtn.disabled = false
          saveBtn.textContent = 'Cadastrar'
        }
      })

      footerEl.append(cancelBtn, saveBtn)
    },
  })
}

function openEditPermissions(user) {
  openModal({
    title: `Permissões — ${user.name || user.email}`,
    size: 'md',
    renderBody: (body, close) => {
      const { el: permsEl, getState } = buildPermissionsSection(user.permissions)

      mount(body,
        el('div', { class: 'field' },
          el('label', {}, 'Módulos que esta usuária pode acessar'),
          permsEl
        ),
      )

      body._getState = getState
      body._close = close
    },
    footer: (close, footerEl) => {
      const cancelBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancelar')
      const saveBtn   = el('button', { class: 'btn btn-primary', type: 'button' }, 'Salvar')

      cancelBtn.addEventListener('click', close)

      saveBtn.addEventListener('click', async () => {
        const body = document.querySelector('.modal-body')
        const permissions = body?._getState?.() ?? {}

        saveBtn.disabled = true
        saveBtn.textContent = 'Salvando...'
        try {
          await updateDoc(doc(db, 'users', user.id), { permissions })
          toastSuccess('Permissões atualizadas.')
          close()
        } catch (err) {
          toastError(err.message || 'Erro ao salvar permissões')
          saveBtn.disabled = false
          saveBtn.textContent = 'Salvar'
        }
      })

      footerEl.append(cancelBtn, saveBtn)
    },
  })
}

export function render(container) {
  if (!isMaster()) {
    mount(container, el('p', { class: 'text-muted' }, 'Acesso restrito a administradores.'))
    return
  }

  const tbody = document.createElement('tbody')
  const table = el('table', { class: 'data-table' },
    el('thead', {},
      el('tr', {},
        el('th', {}, 'Nome'),
        el('th', {}, 'E-mail'),
        el('th', {}, 'Perfil'),
        el('th', {}, 'Status'),
        el('th', { class: 'col-actions' }, 'Ações'),
      )
    ),
    tbody
  )

  const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, '+ Nova Usuária')
  addBtn.addEventListener('click', openUserForm)

  mount(container,
    el('div', { class: 'toolbar' },
      el('h2', {}, 'Usuários'),
      addBtn,
    ),
    el('div', { class: 'table-wrapper' }, table),
  )

  const unsub = onSnapshot(collection(db, 'users'), snap => {
    const users = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    const rows = users.map(u => {
      const isSelf = u.role === 'master'
      const statusBadge = el('span', {
        class: `badge ${u.active ? 'badge-pj' : ''}`,
        style: u.active ? '' : 'background:#f3f4f6;color:#9ca3af',
      }, u.active ? 'Ativo' : 'Inativo')

      const toggleBtn = el('button', {
        class: `btn btn-sm ${u.active ? 'btn-danger-outline' : 'btn-outline'}`,
        type: 'button',
        ...(isSelf ? { disabled: '' } : {}),
        title: isSelf ? 'Conta master não pode ser alterada' : '',
      }, u.active ? 'Desativar' : 'Ativar')

      if (!isSelf) {
        toggleBtn.addEventListener('click', () => {
          openConfirm({
            title: u.active ? 'Desativar usuário?' : 'Ativar usuário?',
            message: u.active
              ? `${u.name} perderá o acesso ao sistema.`
              : `${u.name} voltará a ter acesso ao sistema.`,
            confirmLabel: u.active ? 'Desativar' : 'Ativar',
            danger: u.active,
            onConfirm: async () => {
              await updateDoc(doc(db, 'users', u.id), { active: !u.active })
              toastSuccess(u.active ? 'Usuário desativado.' : 'Usuário ativado.')
            },
          })
        })
      }

      const actionsWrap = el('div', { class: 'row-actions' })
      if (!isSelf) {
        const permsBtn = el('button', { class: 'btn btn-sm btn-outline', type: 'button' }, 'Permissões')
        permsBtn.addEventListener('click', () => openEditPermissions(u))
        actionsWrap.appendChild(permsBtn)
      }
      actionsWrap.appendChild(toggleBtn)
      const actionsCell = el('td', { class: 'col-actions' }, actionsWrap)

      return el('tr', {},
        el('td', {}, u.name || '—'),
        el('td', {}, u.email || '—'),
        el('td', {}, u.role === 'master' ? 'Master' : 'Funcionária'),
        el('td', {}, statusBadge),
        actionsCell,
      )
    })

    tbody.replaceChildren(...rows)
  })

  return () => unsub()
}
