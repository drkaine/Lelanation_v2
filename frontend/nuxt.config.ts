// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // SSR enabled by default in Nuxt 3 for MPA support
  // File-based routing via pages/ directory automatically creates routes
  ssr: true,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  vite: {
    server: {
      hmr: {
        clientPort: 443,
      },
      allowedHosts: ['www.lelanation.fr', 'lelanation.fr', 'localhost', '127.0.0.1'],
    },
  },
})
