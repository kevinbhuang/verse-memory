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
        // Avoid workbox+terser flaking out during SW generation (exit code 1).
        minify: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Verse Memory',
          short_name: 'Verse Memory',
          description:
            'A focused Scripture memory workspace for learning, reviewing, and retaining a fixed collection of 171 passages.',
          theme_color: '#c45c26',
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

      // Local stand-in for the Netlify esv-text function.
      {
        name: 'esv-text-dev-api',
        configureServer(server) {
          server.middlewares.use('/api/esv-text', async (req, res, next) => {
            if (req.method !== 'GET') {
              next();
              return;
            }
            try {
              const url = new URL(req.url ?? '', 'http://localhost');
              const q = url.searchParams.get('q')?.trim();
              if (!q) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({ error: 'Missing q (passage reference)' }),
                );
                return;
              }
              const token = env.ESV_API_TOKEN;
              if (!token) {
                res.statusCode = 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error:
                      'ESV text is not configured (set ESV_API_TOKEN in .env).',
                  }),
                );
                return;
              }
              const upstreamUrl = new URL(
                'https://api.esv.org/v3/passage/text/',
              );
              upstreamUrl.searchParams.set('q', q);
              upstreamUrl.searchParams.set('include-headings', 'false');
              upstreamUrl.searchParams.set('include-footnotes', 'false');
              upstreamUrl.searchParams.set('include-verse-numbers', 'false');
              upstreamUrl.searchParams.set('include-short-copyright', 'false');
              upstreamUrl.searchParams.set(
                'include-passage-references',
                'false',
              );
              const upstream = await fetch(upstreamUrl, {
                headers: { Authorization: `Token ${token}` },
              });
              if (!upstream.ok) {
                res.statusCode = upstream.status === 401 ? 502 : upstream.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `ESV text request failed (${upstream.status}).`,
                  }),
                );
                return;
              }
              const body = await upstream.json();
              const passages = body.passages ?? [];
              if (passages.length === 0) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    error: `No ESV passage found for “${q}”.`,
                  }),
                );
                return;
              }
              const text = passages.join(' ').replace(/\s+/g, ' ').trim();
              const canonicalReference =
                typeof body.canonical === 'string' && body.canonical.trim()
                  ? body.canonical.trim()
                  : q;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  reference: q,
                  canonicalReference,
                  text,
                  translation: 'ESV',
                }),
              );
            } catch (error) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error:
                    error instanceof Error
                      ? error.message
                      : 'ESV text proxy error',
                }),
              );
            }
          });
        },
      },
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
          // Trailing slash required — without it ESV 301s and <audio> falls
          // back to browser TTS (often a female system voice).
          rewrite: (path) =>
            path.replace(/^\/api\/esv-audio/, '/v3/passage/audio/'),
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
