/**
 * Cria o documento do usuário MASTER no Firestore.
 *
 * Como usar:
 *  1. Acesse Firebase Console → Authentication → Add user
 *     Email: vitor.rix@icloud.com  |  Senha: (defina uma)
 *  2. Copie o UID gerado
 *  3. Abra o console do navegador na aplicação (eixo.barukstore.com.br)
 *  4. Cole o trecho abaixo substituindo SEU_UID_AQUI pelo UID real
 */

const UID = 'SEU_UID_AQUI'

const MASTER_PROFILE = {
  name: 'Vitor',
  email: 'vitor.rix@icloud.com',
  role: 'master',
  active: true,
  permissions: {},
  createdAt: new Date().toISOString(),
}

// Cole no console do navegador após importar db do Firebase:
// import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js'
// await setDoc(doc(db, 'users', UID), MASTER_PROFILE)

console.log('Perfil master:', JSON.stringify(MASTER_PROFILE, null, 2))
console.log('UID a substituir:', UID)
