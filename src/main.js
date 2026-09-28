import './shared/styles/global.css'
import { onSessionReady } from './auth/session.js'
import { initRouter } from './router/index.js'
import { iniciarValoresOcultos } from './shared/utils/valoresOcultos.js'
import { iniciarTema } from './shared/utils/tema.js'

iniciarTema()
iniciarValoresOcultos()

onSessionReady(() => {
  initRouter()
})
