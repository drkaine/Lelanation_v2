/// <reference types="node" />
// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SITE_URL } from './utils/siteUrl'
import { ICON_API_ENDPOINT, apiProxyRouteRules } from './utils/apiRouteRules'
import { createSharedStatsChunk, statsPageChunk } from './utils/statsChunks'

// One memo per Rollup build.
const sharedStatsChunks = new WeakMap<object, (id: string) => string | undefined>()

type GetModuleInfo = (id: string) => { importers: readonly string[] } | null

/** Client-only: on the server build (Vite 8), manual chunks leave unresolved style chunk refs. */
function manualChunks(id: string, { getModuleInfo }: { getModuleInfo: GetModuleInfo }) {
  let sharedStatsChunk = sharedStatsChunks.get(getModuleInfo)
  if (!sharedStatsChunk) {
    sharedStatsChunk = createSharedStatsChunk(m => getModuleInfo(m)?.importers ?? [])
    sharedStatsChunks.set(getModuleInfo, sharedStatsChunk)
  }
  if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) {
    return 'vendor-vue'
  }
  if (id.includes('node_modules/pinia/') || id.includes('node_modules/vue-router/')) {
    return 'vendor-state-router'
  }
  // Locale JSON stays out of this chunk: lazy i18n loads fr.json / en.json on demand.
  if (
    id.includes('node_modules/@nuxtjs/i18n') ||
    id.includes('node_modules/vue-i18n') ||
    (id.includes('/frontend/i18n/') && !id.includes('/frontend/i18n/locales/'))
  ) {
    return 'i18n'
  }
  if (id.includes('node_modules/@lelanation/builds-ui')) {
    return 'builds-ui'
  }
  return statsPageChunk(id) ?? sharedStatsChunk(id)
}

/** Read fallback game version from backend/data/game/version.json at build time */
function getFallbackGameVersionFromBackend(): string {
  const cwd = process.cwd()
  const candidates = [
    join(cwd, 'backend', 'data', 'game', 'version.json'),
    join(cwd, '..', 'backend', 'data', 'game', 'version.json'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        const data = JSON.parse(readFileSync(path, 'utf-8')) as { currentVersion?: string }
        if (data?.currentVersion && typeof data.currentVersion === 'string') {
          return data.currentVersion
        }
      } catch {
        // ignore
      }
      break
    }
  }
  return '16.3.1'
}

const defaultSiteUrl = process.env.NUXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
const defaultApiBase =
  process.env.NUXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3500' : defaultSiteUrl)

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // SSR enabled by default in Nuxt 3 for MPA support
  // File-based routing via pages/ directory automatically creates routes
  ssr: true,
  // Nuxt imports PostCSS plugins as ESM; Tailwind 3 only exposes `tailwindcss/nesting` to require().
  postcss: {
    plugins: { 'tailwindcss/nesting/index.js': {}, 'tailwindcss/nesting': false },
  },
  hooks: {
    'vite:extendConfig'(config, { isClient }) {
      const build = config.build
      if (!isClient || !build) return
      const output = build.rollupOptions?.output
      if (Array.isArray(output)) return
      build.rollupOptions = { ...build.rollupOptions, output: { ...output, manualChunks } }
    },
  },
  experimental: {
    // Désactivé : l'extraction externe ne garde que les asyncData (~108 o) et le client
    // préfère data-src au JSON inline (Pinia 240k+ o) → hydratation cassée, 500 "26".
    payloadExtraction: false,
    defaults: {
      nuxtLink: {
        prefetch: false,
        prefetchOn: { visibility: false, interaction: false },
      },
    },
  },
  app: {
    head: {
      title: 'Lelanation - Builds League of Legends',
      titleTemplate: '%s | Lelanation',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Plateforme de builds et guides League of Legends par la communauté Lelariva. Créez, optimisez et partagez vos builds. Statistiques, theorycraft, vidéos.',
        },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:image', content: `${defaultSiteUrl}/og/default.png` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: `${defaultSiteUrl}/og/default.png` },
      ],
      link: [{ rel: 'canonical', href: defaultSiteUrl }],
    },
  },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', '@pinia/nuxt', '@nuxtjs/i18n', '@nuxtjs/robots'],
  icon: {
    localApiEndpoint: ICON_API_ENDPOINT,
    clientBundle: {
      scan: true,
      icons: [
        'mdi:close',
        'mdi:refresh',
        'mdi:discord',
        'mdi:instagram',
        'mdi:facebook',
        'mdi:patreon',
        'mdi:youtube',
        'mdi:twitch',
        'mdi:twitter',
        'mdi:music-note',
        'mdi:web',
      ],
      sizeLimitKb: 512,
    },
  },
  // Backend API base for proxying /api/* calls.
  // Default matches `ecosystem.config.js` (backend PORT=4001).
  runtimeConfig: {
    admin: {
      // If not set, admin routes won't be protected (dev convenience).
      username: process.env.ADMIN_USERNAME || '',
      password: process.env.ADMIN_PASSWORD || '',
      pathPrefix: process.env.ADMIN_PATH_PREFIX || '/admin',
    },
    public: {
      // Prefer same-origin `/api` in production. In dev you can still set
      // NUXT_PUBLIC_API_BASE=http://localhost:4001 if needed.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      siteUrl: defaultSiteUrl,
      companionAppDownloadUrl: process.env.NUXT_PUBLIC_COMPANION_APP_DOWNLOAD_URL || '',
      // Matomo: set NUXT_PUBLIC_MATOMO_HOST and NUXT_PUBLIC_MATOMO_SITE_ID to enable
      matomoHost: process.env.NUXT_PUBLIC_MATOMO_HOST || '',
      matomoSiteId: process.env.NUXT_PUBLIC_MATOMO_SITE_ID || '',
      /** Fallback game version from backend/data/game/version.json (read at build time) */
      fallbackGameVersion: getFallbackGameVersionFromBackend(),
    },
  },
  site: {
    url: defaultSiteUrl,
  },
  i18n: {
    baseUrl: defaultSiteUrl,
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    // Files live in frontend/i18n/locales/ (restructureDir defaults to "i18n").
    langDir: 'locales',
    // Allow HTML in locale messages (legal/privacy pages use <strong> etc. with v-html).
    compilation: {
      strictMessage: false,
    },
    // lazy: true loads fr.json / en.json when the locale is first used. When the user switches
    // language (LanguageSwitcher → switchLocalePath), the new locale is set and the corresponding
    // JSON is loaded, so t() returns the correct language.
    lazy: true,
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    vueI18n: './i18n.config.ts',
  } as any,
  robots: {
    disallow: ['/admin', '/api/admin', '/render', '/matchups/sheets'],
    sitemap: [`${defaultSiteUrl}/sitemap.xml`],
  },
  routeRules: {
    // Pas de swr/cache Nitro sur les pages HTML : évite data-src _payload.json (500 client "26").
    '/': { prerender: false },
    // Pas de SWR sur /builds/* : même raison (payload.json fantôme après navigation).
    '/builds/discover': { prerender: false },
    '/builds/my-builds': { prerender: false },
    '/builds/favoris': { prerender: false },
    '/builds/create': { prerender: false },
    '/builds/create/**': { prerender: false },
    '/builds/compare': { prerender: false },
    '/items': { prerender: false },
    '/items/**': { prerender: false },
    '/builds/champion/**': { prerender: false },
    '/champion/**': { prerender: false },
    '/champions/**': { prerender: false },
    '/statistics': { prerender: false },
    '/statistics/tier-list': { prerender: false },
    '/statistics/meta-chart': { prerender: false },
    '/statistics/recap': { prerender: false },
    '/statistics/settings': { redirect: { to: '/settings', statusCode: 301 } },
    '/en/statistics/settings': { redirect: { to: '/en/settings', statusCode: 301 } },
    '/statistics/surveillance': { ssr: false },
    '/statistics/champion/**': { prerender: false },
    '/statistics/item/**': { prerender: false },
    '/videos': { prerender: false },
    '/patch-notes': { prerender: false },
    '/patch-notes/**': { prerender: false },
    '/sitemap.xml': { cache: { maxAge: 3600 } },
    '/privacy': { prerender: false },
    '/information': { prerender: false },
    '/settings': { ssr: false },
    '/legal': { prerender: false },
    '/lelanation-app': { redirect: { to: '/download', statusCode: 301 } },
    '/en/lelanation-app': { redirect: { to: '/en/download', statusCode: 301 } },
    '/app': { redirect: { to: '/download', statusCode: 301 } },
    '/en/app': { redirect: { to: '/en/download', statusCode: 301 } },
    '/download': { ssr: false },
    '/map/**': { ssr: false },
    '/matchups/sheets': { ssr: false },
    '/matchups/sheets/**': { ssr: false },
    '/en/matchups/sheets': { ssr: false },
    '/en/matchups/sheets/**': { ssr: false },
    '/guides/matchups': { redirect: { to: '/matchups/sheets', statusCode: 301 } },
    '/en/guides/matchups': { redirect: { to: '/en/matchups/sheets', statusCode: 301 } },
    '/render/**': { ssr: false },
  },
  // NUXT_BUILD_DIR / NUXT_OUTPUT_DIR: build elsewhere than the live `.output` (verification builds).
  ...(process.env.NUXT_BUILD_DIR ? { buildDir: process.env.NUXT_BUILD_DIR } : {}),
  nitro: {
    ...(process.env.NUXT_OUTPUT_DIR ? { output: { dir: process.env.NUXT_OUTPUT_DIR } } : {}),
    prerender: {
      crawlLinks: false,
      // Sitemap uniquement — collectPrerenderRoutes() (~644 routes) ne produisait que 2 fichiers.
      routes: [],
    },
    devProxy: {
      '/api': {
        target: defaultApiBase,
        changeOrigin: true,
      },
    },
    // Also proxy in production (when running `.output/server/index.mjs`)
    routeRules: {
      // Immutable build assets (hashed filenames).
      '/_nuxt/**': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      },
      // Public static assets (non-hashed).
      '/images/**': {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      },
      // Game data JSON files (long cache, versioned by path)
      '/data/game/**': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      },
      // YouTube data JSON files (long cache)
      '/data/youtube/**': {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      },
      // latest images are mutable by design
      '/images/game/latest/**': {
        headers: {
          'Cache-Control': 'public, max-age=3600',
        },
      },
      // Game images (long cache for versioned paths)
      '/images/game/**': {
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      },
      '/favicon.ico': {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      },
      '/manifest.json': {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      },
      // Service Worker files (if any) should NEVER be cached
      '/sw.js': {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
      // Legacy SW filename used by some setups
      '/service-worker.js': {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
      '/sw.js.map': {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
      '/workbox-*.js': {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
      '/_robots.txt': {
        headers: {
          'Cache-Control': 'public, max-age=86400',
        },
      },
      [`${ICON_API_ENDPOINT}/**`]: {
        cors: true,
        headers: {
          // Safe cache: response depends on querystring, but is static per request.
          'Cache-Control': 'public, max-age=86400',
        },
      },
      ...apiProxyRouteRules(defaultApiBase),
      // Pages/HTML: no-store would block back/forward cache (bfcache). Use no-cache
      // so the doc can be bfcached while still revalidating on return.
      // Security headers (HSTS, CSP, X-Frame-Options, nosniff…) are set by nginx.
      '/**': {
        headers: {
          'Cache-Control': 'no-cache',
        },
      },
    },
  },
  build: {
    transpile: ['@lelanation/shared-types', '@lelanation/shared-theme', '@lelanation/builds-ui'],
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 600,
      // Rolldown timing report is profiling noise, not a build problem.
      rolldownOptions: { checks: { pluginTimings: false } },
    },
    server: {
      allowedHosts: ['www.lelanation.fr', 'lelanation.fr', 'localhost', '127.0.0.1'],
    },
  },
})
