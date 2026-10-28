import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiUrl } from './apiUrl'

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
