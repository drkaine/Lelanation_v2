/// <reference types="node" />
// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

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

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // SSR enabled by default in Nuxt 3 for MPA support
  // File-based routing via pages/ directory automatically creates routes
  ssr: true,
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
      ],
      link: [
        { rel: 'canonical', href: process.env.NUXT_PUBLIC_SITE_URL || 'https://lelanation.fr' },
      ],
    },
  },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
  ],
  icon: {
    clientBundle: {
      scan: true,
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
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://lelanation.fr',
      companionAppDownloadUrl: process.env.NUXT_PUBLIC_COMPANION_APP_DOWNLOAD_URL || '',
      // Matomo: set NUXT_PUBLIC_MATOMO_HOST and NUXT_PUBLIC_MATOMO_SITE_ID to enable
      matomoHost: process.env.NUXT_PUBLIC_MATOMO_HOST || '',
      matomoSiteId: process.env.NUXT_PUBLIC_MATOMO_SITE_ID || '',
      /** Fallback game version from backend/data/game/version.json (read at build time) */
      fallbackGameVersion: getFallbackGameVersionFromBackend(),
    },
  },
  site: {
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://lelanation.fr',
  },
  i18n: {
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://lelanation.fr',
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
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
    disallow: ['/admin', '/api/admin'],
  },
  sitemap: {
    sitemaps: {
      default: {
        include: [
          '/',
          '/builds',
          '/builds/create',
          '/theorycraft',
          '/videos',
          '/statistics',
          '/privacy',
          '/legal',
          '/lelanation-app',
        ],
        exclude: ['/api/**', '/admin', '/admin/**'],
      },
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
      // Game images (long cache, versioned by path)
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
      // IMPORTANT: Nuxt Icon module serves icons via a Nuxt endpoint under /api/_nuxt_icon/**.
      // Do NOT proxy this to the backend, otherwise users get 502s.
      // This rule MUST come before the /api/** proxy rule to take precedence.
      '/api/_nuxt_icon/**': {
        cors: true,
        headers: {
          // Safe cache: response depends on querystring, but is static per request.
          'Cache-Control': 'public, max-age=86400',
        },
      },
      // Proxy all other /api/** requests to the backend, but NOT /api/_nuxt_icon/**
      // Note: The route above takes precedence, so /api/_nuxt_icon/** won't be proxied
      '/api/**': {
        proxy: (process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4001') + '/**',
      },
      // Pages/HTML should not be cached aggressively. Prevents "new HTML + old _nuxt"
      // or "old HTML + new _nuxt" mismatches during deployments.
      '/**': {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    },
  },
  vite: {
    server: {
      allowedHosts: ['www.lelanation.fr', 'lelanation.fr', 'localhost', '127.0.0.1'],
    },
  },
})
