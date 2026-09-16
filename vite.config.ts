import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://api.jikan.moe; img-src 'self' https://cdn.myanimelist.net data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// https://vite.dev/config/
export default defineConfig({
  preview: { headers: securityHeaders },
  define: {
    __APP_VERSION__: JSON.stringify('0.0.13'),
  },
  plugins: [
    react(),
    {
      name: 'security-headers',
      apply: 'build',
      transformIndexHtml() {
        // Retain resource restrictions on hosts without header-file support.
        // Framing protection still requires the HTTP response header.
        return [{
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: securityHeaders['Content-Security-Policy'].replace("; frame-ancestors 'none'", ''),
          },
          injectTo: 'head-prepend',
        }]
      },
      generateBundle() {
        // Netlify and Cloudflare Pages consume this file as response headers.
        this.emitFile({
          type: 'asset',
          fileName: '_headers',
          source: `/*\n${Object.entries(securityHeaders).map(([name, value]) => `  ${name}: ${value}`).join('\n')}\n`,
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AniCount',
        short_name: 'AniCount',
        description: 'AniCount tracks upcoming anime release dates with a live multi-anime countdown.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
