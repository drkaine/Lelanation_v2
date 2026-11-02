import { describe, expect, it } from 'vitest'
import {
  buildVisibilityOptions,
  canManageSharedBuilds,
  parseStoredSession,
  postLoginPath,
  registerErrorKey,
} from '../userSession'

describe('userSession', () => {
  it('parses a stored session and rejects garbage or unknown roles', () => {
    const ok = JSON.stringify({ token: 'abc', user: { id: 1, username: 'Riva', role: 'lelariva' } })
    expect(parseStoredSession(ok)).toEqual({
      token: 'abc',
      user: { id: 1, username: 'Riva', role: 'lelariva' },
    })
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('{oops')).toBeNull()
    expect(
      parseStoredSession(
        JSON.stringify({ token: 'abc', user: { id: 1, username: 'x', role: 'root' } })
      )
    ).toBeNull()
  })

  it('admin lands on /admin, lelariva on /equipe, lelateam on /builds', () => {
    expect(postLoginPath('admin')).toBe('/admin')
    expect(postLoginPath('lelariva')).toBe('/equipe')
    expect(postLoginPath('lelateam')).toBe('/builds')
  })

  it('logged-in roles get the shared option in the builder, anonymous does not', () => {
    expect(buildVisibilityOptions(null)).toEqual(['public', 'private'])
    expect(buildVisibilityOptions('lelateam')).toEqual(['public', 'private', 'shared'])
  })

  it('only admin and lelariva publish or delete shared builds', () => {
    expect(canManageSharedBuilds('admin')).toBe(true)
    expect(canManageSharedBuilds('lelariva')).toBe(true)
    expect(canManageSharedBuilds('lelateam')).toBe(false)
    expect(canManageSharedBuilds(null)).toBe(false)
  })

  it('maps API register errors to i18n keys', () => {
    expect(registerErrorKey('INVALID_CODE')).toBe('auth.errors.invalidCode')
    expect(registerErrorKey('USERNAME_TAKEN')).toBe('auth.errors.usernameTaken')
    expect(registerErrorKey('whatever')).toBe('auth.errors.generic')
  })
})
