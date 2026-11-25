import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiUrl, statsRegionPath } from './apiUrl'
import { setStatsRegions } from './statsRegion'

describe('apiUrl outside Nuxt context', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does not call useRuntimeConfig when no Nuxt app is active (no NUXT_E1001 report)', () => {
    const useRuntimeConfig = vi.fn(() => {
      throw new Error('[NUXT_E1001]')
    })
    vi.stubGlobal('useRuntimeConfig', useRuntimeConfig)
    vi.stubGlobal('tryUseNuxtApp', () => null)
    vi.stubEnv('NUXT_PUBLIC_API_BASE', 'http://127.0.0.1:3500')
    expect(apiUrl('/api/x')).toBe('http://127.0.0.1:3500/api/x')
    expect(useRuntimeConfig).not.toHaveBeenCalled()
  })

  it('uses the active Nuxt app config', () => {
    vi.stubGlobal('tryUseNuxtApp', () => ({ $config: { public: { apiBase: 'http://api.test/' } } }))
    expect(apiUrl('/api/x')).toBe('http://api.test/api/x')
  })
})

describe('apiUrl — région des stats', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setStatsRegions([])
  })

  it('serveur : lit le cookie stats_region de la requête, /api/stats seulement', () => {
    vi.stubGlobal('tryUseNuxtApp', () => ({
      $config: { public: { apiBase: 'http://api.test' } },
      ssrContext: { event: { node: { req: { headers: { cookie: 'stats_region=kr' } } } } },
    }))
    expect(apiUrl('/api/stats/x?a=1')).toBe('http://api.test/api/stats/x?a=1&region=KR')
    expect(apiUrl('/api/builds')).toBe('http://api.test/api/builds')
  })

  it('serveur sans cookie : toutes régions (pas de param)', () => {
    vi.stubGlobal('tryUseNuxtApp', () => ({ $config: { public: { apiBase: 'http://api.test' } } }))
    expect(apiUrl('/api/stats/x')).toBe('http://api.test/api/stats/x')
  })
  it('statsRegionPath : chemin relatif (useRequestFetch) avec la région', () => {
    vi.stubGlobal('tryUseNuxtApp', () => ({
      ssrContext: { event: { node: { req: { headers: { cookie: 'stats_region=EUW1' } } } } },
    }))
    expect(statsRegionPath('/api/stats/items/1/breakdown?a=1')).toBe(
      '/api/stats/items/1/breakdown?a=1&region=EUW1'
    )
  })

  it('serveur : plusieurs régions du cookie', () => {
    vi.stubGlobal('tryUseNuxtApp', () => ({
      $config: { public: { apiBase: 'http://api.test' } },
      ssrContext: { event: { node: { req: { headers: { cookie: 'stats_region=KR%2Ceuw1' } } } } },
    }))
    expect(apiUrl('/api/stats/x')).toBe('http://api.test/api/stats/x?region=EUW1,KR')
  })
})
