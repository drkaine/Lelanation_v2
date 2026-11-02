import { describe, expect, it } from 'vitest'
import {
  adminAuthHeader,
  canAccessTeamPage,
  inviteLink,
  isLoginEndpointMissing,
  roleChoicesFor,
  teamGuardDecision,
} from '../teamAccess'

const session = (role: 'admin' | 'lelariva' | 'lelateam') => ({
  token: 'tok',
  user: { id: 1, username: 'u', role },
})

describe('teamAccess', () => {
  it('team page is for admin and lelariva only', () => {
    expect(canAccessTeamPage('admin')).toBe(true)
    expect(canAccessTeamPage('lelariva')).toBe(true)
    expect(canAccessTeamPage('lelateam')).toBe(false)
    expect(canAccessTeamPage(null)).toBe(false)
  })

  it('team guard: login without session, forbidden for lelateam, ignores other routes', () => {
    expect(teamGuardDecision({ path: '/equipe', role: null })).toBe('login')
    expect(teamGuardDecision({ path: '/en/equipe', role: 'lelateam' })).toBe('forbidden')
    expect(teamGuardDecision({ path: '/equipe', role: 'lelariva' })).toBe('allow')
    expect(teamGuardDecision({ path: '/builds', role: null })).toBe('allow')
    expect(teamGuardDecision({ path: '/equipes-pro', role: null })).toBe('allow')
  })

  it('admin header: admin bearer session first, then basic token, else none', () => {
    expect(adminAuthHeader(session('admin'), 'b64')).toEqual({ Authorization: 'Bearer tok' })
    expect(adminAuthHeader(session('lelariva'), 'b64')).toEqual({ Authorization: 'Basic b64' })
    expect(adminAuthHeader(null, 'b64')).toEqual({ Authorization: 'Basic b64' })
    expect(adminAuthHeader(session('lelariva'), null)).toBeNull()
  })

  it('invite link carries the code on the localized register page', () => {
    expect(inviteLink('https://x.fr', '/inscription', 'AB CD')).toBe(
      'https://x.fr/inscription?code=AB%20CD'
    )
    expect(inviteLink('https://x.fr/', '/en/inscription', 'K1')).toBe(
      'https://x.fr/en/inscription?code=K1'
    )
  })

  it('role choices keep the current role visible even if not invitable', () => {
    expect(roleChoicesFor(['lelateam'], 'lelateam')).toEqual(['lelateam'])
    expect(roleChoicesFor(['admin', 'lelariva', 'lelateam'], 'lelariva')).toEqual([
      'admin',
      'lelariva',
      'lelateam',
    ])
  })

  it('a 404 on /api/users/login means the old backend: fall back to basic auth', () => {
    expect(isLoginEndpointMissing(404)).toBe(true)
    expect(isLoginEndpointMissing(401)).toBe(false)
  })
})
