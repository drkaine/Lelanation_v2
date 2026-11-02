import { describe, expect, it } from 'vitest'
import { resolveErrorPage } from '../errorPage'

describe('resolveErrorPage', () => {
  it('404_is_not_found_without_retry', () => {
    const p = resolveErrorPage(404)
    expect(p.kind).toBe('notFound')
    expect(p.code).toBe('404')
    expect(p.canRetry).toBe(false)
  })

  it('401_and_403_are_forbidden', () => {
    expect(resolveErrorPage(401).kind).toBe('forbidden')
    expect(resolveErrorPage(403).kind).toBe('forbidden')
  })

  it('502_503_504_are_unavailable_with_retry', () => {
    for (const code of [502, 503, 504]) {
      const p = resolveErrorPage(code)
      expect(p.kind).toBe('unavailable')
      expect(p.canRetry).toBe(true)
    }
  })

  it('other_5xx_is_server_error_with_retry', () => {
    const p = resolveErrorPage(500)
    expect(p.kind).toBe('server')
    expect(p.canRetry).toBe(true)
  })

  it('unknown_or_missing_code_falls_back_to_generic', () => {
    expect(resolveErrorPage(undefined)).toMatchObject({ kind: 'generic', code: '' })
    expect(resolveErrorPage(418).kind).toBe('generic')
    expect(resolveErrorPage(418).code).toBe('418')
  })

  it('i18n_keys_follow_kind', () => {
    const p = resolveErrorPage(404)
    expect(p.titleKey).toBe('errorPage.notFound.title')
    expect(p.messageKey).toBe('errorPage.notFound.message')
  })
})
