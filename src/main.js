import './shared/styles/global.css'
import { onSessionReady } from './auth/session.js'
import { initRouter } from './router/index.js'

onSessionReady(() => {
  initRouter()
})
