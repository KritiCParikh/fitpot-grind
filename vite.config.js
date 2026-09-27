import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the site at https://<user>.github.io/<repo>/
// The deploy workflow sets BASE_PATH to "/<repo>/"; locally it's "/".
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'data/indb.json'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json}'] },
      manifest: {
        name: 'FitPot',
        short_name: 'FitPot',
        description: 'Fitness accountability for friend groups',
        theme_color: '#0b0d0c',
        background_color: '#0b0d0c',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
