import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { ttfBase64Plugin } from './scripts/ttfBase64Plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      ttfBase64Plugin(),

      VitePWA({
        // Activate new builds automatically so users are not stuck on an old
        // cached shell waiting for a "Reload" click.
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Verse Memory',
          short_name: 'Verse Memory',
          description:
            'A focused Scripture memory workspace for learning, reviewing, and retaining a fixed collection of 171 passages.',
          theme_color: '#1f2937',
          background_color: '#f5f6f8',
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
          skipWaiting: true,
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
      proxy: {
        // Local stand-in for the Netlify esv-audio function. Keeps ESV_API_TOKEN
        // on the server (never inlined into the browser bundle).
        '/api/esv-audio': {
          target: 'https://api.esv.org',
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/api\/esv-audio/, '/v3/passage/audio'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.ESV_API_TOKEN) {
                proxyReq.setHeader(
                  'Authorization',
                  `Token ${env.ESV_API_TOKEN}`,
                );
              }
            });
          },
        },
      },
    },
    preview: {
      port: 4173,
    },
  };
});
