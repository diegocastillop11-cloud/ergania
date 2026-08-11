import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// El APK empaqueta el frontend compilado, así que el snippet de AdSense de
// index.html (que Google necesita ver en el HTML servido de la web) terminaría
// cargándose dentro de la app Android de pago. Fuera del build de Capacitor.
function stripAdSenseForCapacitor(mode: string) {
  return {
    name: 'strip-adsense-capacitor',
    transformIndexHtml(html: string) {
      if (mode !== 'capacitor') return html
      return html
        .replace(/\s*<meta name="google-adsense-account"[^>]*>/, '')
        .replace(/\s*<script[^>]*pagead2\.googlesyndication\.com[^>]*><\/script>/, '')
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), stripAdSenseForCapacitor(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.PORT) || 3001,
    proxy: {
      '/api': 'http://localhost:4001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
