/**
 * Cria o documento do usuário MASTER no Firestore após o primeiro login.
 * Execute uma vez no console do navegador (ou adapte para Node com Admin SDK).
 *
 * Como usar:
 *  1. Faça login no Firebase Console e crie o usuário com email/senha.
 *  2. Abra o console do navegador na aplicação logada.
 *  3. Cole este snippet (substituindo UID e dados reais).
 *
 * Estrutura do documento /users/{uid}:
 */
const MASTER_PROFILE = {
  name: 'Baruk',
  email: 'barukerstore@gmail.com',
  role: 'master',
  active: true,
  permissions: {},  // master ignora permissões, campo vazio
  createdAt: new Date().toISOString(),
}

// Via Admin SDK (Node.js):
// const admin = require('firebase-admin')
// admin.initializeApp({ credential: admin.credential.applicationDefault() })
// await admin.firestore().doc(`users/${UID}`).set(MASTER_PROFILE)

console.log('Perfil master a ser criado:', JSON.stringify(MASTER_PROFILE, null, 2))
console.log('Substitua o UID pelo uid real do Firebase Auth antes de executar.')
