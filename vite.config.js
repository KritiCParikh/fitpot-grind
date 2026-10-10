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
      // 'prompt': a new version waits until you tap "Update" (see UpdateBar.jsx).
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icons/*.png', 'splash/*.png', 'data/indb.json', 'push-sw.js'],
      workbox: {
        importScripts: ['push-sw.js'], // reminders (phase 5.8)
        globPatterns: ['**/*.{js,css,html,svg,json,png}'],
        globIgnores: ['splash/**'], // splash screens are only fetched by iPhones at install
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        id: base,
        name: 'FitPot',
        short_name: 'FitPot',
        description: 'Fitness accountability for friend groups: check in, keep the streak, split the pot.',
        theme_color: '#0b0d0c',
        background_color: '#0b0d0c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        // Long-press the app icon for these.
        shortcuts: [
          { name: 'Check in', short_name: 'Check in', url: `${base}#/today`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Log workout', short_name: 'Workout', url: `${base}#/?me=training`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Food', short_name: 'Food', url: `${base}#/?me=food`, icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
})
