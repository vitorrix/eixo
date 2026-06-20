import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

// Perfil do usuário logado (em memória enquanto a sessão dura)
let currentProfile = null

export function getCurrentProfile() {
  return currentProfile
}

export function isMaster() {
  return currentProfile?.role === 'master'
}

// Verifica se o usuário tem uma permissão específica
// Ex: can('pedidos', 'create')
export function can(module, action) {
  if (!currentProfile) return false
  if (currentProfile.role === 'master') return true
  return !!currentProfile.permissions?.[module]?.[action]
}

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  await loadProfile(credential.user.uid)
  return currentProfile
}

export async function logout() {
  currentProfile = null
  await signOut(auth)
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) throw new Error('Usuário sem cadastro no sistema.')
  const data = snap.data()
  if (!data.active) throw new Error('Usuário desativado. Contate o administrador.')
  currentProfile = { uid, ...data }
}

// Observador de estado de autenticação — chame uma vez no boot da aplicação
// Resolve com o perfil (ou null) assim que o Firebase confirmar o estado
export function onSessionReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        await loadProfile(user.uid)
      } catch {
        currentProfile = null
        await signOut(auth)
      }
    } else {
      currentProfile = null
    }
    callback(currentProfile)
  })
}
