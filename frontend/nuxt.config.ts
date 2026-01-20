// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // SSR enabled by default in Nuxt 3 for MPA support
  // File-based routing via pages/ directory automatically creates routes
  ssr: true,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  // Backend API base for proxying /api/* calls.
  // Default matches `ecosystem.config.js` (backend PORT=4001).
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4001',
    },
  },
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4001',
        changeOrigin: true,
      },
    },
    // Also proxy in production (when running `.output/server/index.mjs`)
    routeRules: {
      '/api/**': {
        proxy: (process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4001') + '/**',
      },
    },
  },
  vite: {
    server: {
      allowedHosts: ['www.lelanation.fr', 'lelanation.fr', 'localhost', '127.0.0.1'],
    },
  },
})
