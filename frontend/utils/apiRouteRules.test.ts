import { describe, expect, it } from 'vitest'
import { ICON_API_ENDPOINT, apiProxyRouteRules } from './apiRouteRules'

describe('apiProxyRouteRules', () => {
  it('proxies /api/** to the backend', () => {
    expect(apiProxyRouteRules('http://127.0.0.1:3500')).toEqual({
      '/api/**': { proxy: 'http://127.0.0.1:3500/api/**' },
    })
  })

  it('serves @nuxt/icon outside /api (nginx and Nitro send /api/** to the backend)', () => {
    expect(ICON_API_ENDPOINT.startsWith('/api/')).toBe(false)
    expect(ICON_API_ENDPOINT.startsWith('/_nuxt/')).toBe(false)
  })
})
