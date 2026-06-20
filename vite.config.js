import { defineConfig } from 'vite'

export default defineConfig({
  base: '/eixo/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
})
