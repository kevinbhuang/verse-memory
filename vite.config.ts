import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { ttfBase64Plugin } from './scripts/ttfBase64Plugin';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ttfBase64Plugin(),

    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Verse Memory',
        short_name: 'Verse Memory',
        description:
          'A focused Scripture memory workspace for learning, reviewing, and retaining a fixed collection of 171 passages.',
        theme_color: '#1f2937',
        background_color: '#faf9f7',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // The passage collection and the vendor libraries change on very
        // different schedules, so they are cached separately.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          storage: ['dexie', 'dexie-react-hooks', 'zod'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
