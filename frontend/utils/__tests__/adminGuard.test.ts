import { describe, expect, it } from 'vitest'
import { adminGuardDecision } from '../adminGuard'

describe('adminGuardDecision', () => {
  it('login_and_connexion_alias_are_public', () => {
    for (const p of [
      '/admin/login',
      '/admin/connexion',
      '/en/admin/login',
      '/en/admin/connexion',
    ]) {
      expect(adminGuardDecision({ path: p, matched: true, hasToken: false })).toBe('allow')
    }
  })

  it('admin_route_without_token_goes_to_login', () => {
    expect(adminGuardDecision({ path: '/admin', matched: true, hasToken: false })).toBe('login')
    expect(
      adminGuardDecision({ path: '/en/admin/youtube-creators', matched: true, hasToken: false })
    ).toBe('login')
  })

  it('admin_route_with_token_is_allowed', () => {
    expect(adminGuardDecision({ path: '/admin', matched: true, hasToken: true })).toBe('allow')
  })

  it('unknown_admin_route_is_left_to_404_instead_of_redirect', () => {
    expect(adminGuardDecision({ path: '/admin/nope', matched: false, hasToken: false })).toBe(
      'allow'
    )
  })

  it('non_admin_routes_are_ignored', () => {
    expect(adminGuardDecision({ path: '/builds', matched: true, hasToken: false })).toBe('allow')
    expect(
      adminGuardDecision({ path: '/administration-guide', matched: true, hasToken: false })
    ).toBe('allow')
  })
})
