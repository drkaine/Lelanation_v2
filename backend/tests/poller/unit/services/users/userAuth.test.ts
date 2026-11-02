import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../../../../src/services/users/passwordHash.js'
import {
  canManageSharedBuilds,
  canManageUser,
  invitableRoles,
  isUserRole,
} from '../../../../../src/services/users/userRoles.js'
import { UserAuthService } from '../../../../../src/services/users/UserAuthService.js'
import { InMemoryUserRepository } from './InMemoryUserRepository.js'

const NOW = new Date('2026-11-02T12:00:00Z')
const DAY = 24 * 3600_000
/** Test passwords are generated at runtime: no credential literal in the repo. */
const PW = randomUUID()
const ROOT = { id: 0, username: 'root', role: 'admin' as const }

function setup(envAdmin?: { username: string; password: string }) {
  const repo = new InMemoryUserRepository()
  const service = new UserAuthService(repo, { envAdmin, now: () => NOW })
  return { repo, service }
}

async function seedUser(service: UserAuthService, role: 'admin' | 'lelariva' | 'lelateam', username: string) {
  const inv = await service.createInvitation(ROOT, role)
  if (!inv.ok) throw new Error('seed invitation failed')
  const reg = await service.register({ code: inv.invitation.code, username, password: PW })
  if (!reg.ok) throw new Error(`seed register failed: ${reg.error}`)
  return reg.user
}

describe('userRoles', () => {
  it('recognises the three roles only', () => {
    expect(isUserRole('admin')).toBe(true)
    expect(isUserRole('lelariva')).toBe(true)
    expect(isUserRole('lelateam')).toBe(true)
    expect(isUserRole('guest')).toBe(false)
  })

  it('admin invites any role, lelariva only lelateam, lelateam none', () => {
    expect(invitableRoles('admin')).toEqual(['admin', 'lelariva', 'lelateam'])
    expect(invitableRoles('lelariva')).toEqual(['lelateam'])
    expect(invitableRoles('lelateam')).toEqual([])
  })

  it('only admin and lelariva publish or delete shared builds', () => {
    expect(canManageSharedBuilds('admin')).toBe(true)
    expect(canManageSharedBuilds('lelariva')).toBe(true)
    expect(canManageSharedBuilds('lelateam')).toBe(false)
  })
})

describe('passwordHash', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword(PW)
    expect(hash).not.toContain(PW)
    expect(await verifyPassword(PW, hash)).toBe(true)
    expect(await verifyPassword(`${PW}x`, hash)).toBe(false)
  })

  it('rejects a malformed hash', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
})

describe('UserAuthService invitations', () => {
  it('admin creates a 7-day invitation with the chosen role', async () => {
    const { service } = setup()
    const res = await service.createInvitation(ROOT, 'lelariva')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.invitation.role).toBe('lelariva')
    expect(res.invitation.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    expect(res.invitation.expiresAt.getTime() - NOW.getTime()).toBe(7 * DAY)
  })

  it('lelariva cannot invite a lelariva, lelateam cannot invite at all', async () => {
    const { service } = setup()
    const r1 = await service.createInvitation({ id: 2, username: 'r', role: 'lelariva' }, 'lelariva')
    const r2 = await service.createInvitation({ id: 3, username: 't', role: 'lelateam' }, 'lelateam')
    expect(r1).toEqual({ ok: false, error: 'FORBIDDEN' })
    expect(r2).toEqual({ ok: false, error: 'FORBIDDEN' })
  })

  it('lelariva lists and revokes only own invitations', async () => {
    const { service } = setup()
    const riva = { id: 2, username: 'r', role: 'lelariva' as const }
    const a = await service.createInvitation(ROOT, 'lelateam')
    const r = await service.createInvitation(riva, 'lelateam')
    if (!a.ok || !r.ok) throw new Error('setup')
    expect((await service.listInvitations(riva)).map(i => i.code)).toEqual([r.invitation.code])
    expect(await service.listInvitations(ROOT)).toHaveLength(2)
    expect(await service.revokeInvitation(riva, a.invitation.code)).toBe(false)
    expect(await service.revokeInvitation(riva, r.invitation.code)).toBe(true)
    expect(await service.listInvitations(ROOT)).toHaveLength(1)
  })
})

describe('UserAuthService register / login', () => {
  it('registers with a valid code, takes the invitation role, and the code is single use', async () => {
    const { service } = setup()
    const inv = await service.createInvitation(ROOT, 'lelateam')
    if (!inv.ok) throw new Error('setup')
    const typed = inv.invitation.code.toLowerCase().replace('-', ' ')
    const reg = await service.register({ code: typed, username: 'Teemo_42', password: PW })
    expect(reg.ok).toBe(true)
    if (!reg.ok) return
    expect(reg.user).toMatchObject({ username: 'Teemo_42', role: 'lelateam' })
    expect(reg.token.length).toBeGreaterThan(30)
    expect(await service.authenticate(reg.token)).toMatchObject({ username: 'Teemo_42' })

    const again = await service.register({ code: inv.invitation.code, username: 'Other', password: PW })
    expect(again).toEqual({ ok: false, error: 'INVALID_CODE' })
  })

  it('rejects an expired code', async () => {
    const { service, repo } = setup()
    const inv = await service.createInvitation(ROOT, 'lelateam')
    if (!inv.ok) throw new Error('setup')
    repo.invitations[0]!.expiresAt = new Date(NOW.getTime() - 1)
    const reg = await service.register({ code: inv.invitation.code, username: 'Late', password: PW })
    expect(reg).toEqual({ ok: false, error: 'INVALID_CODE' })
  })

  it('validates pseudo and password before consuming the code', async () => {
    const { service, repo } = setup()
    const inv = await service.createInvitation(ROOT, 'lelateam')
    if (!inv.ok) throw new Error('setup')
    const code = inv.invitation.code
    expect(await service.register({ code, username: 'a b', password: PW })).toEqual({ ok: false, error: 'INVALID_USERNAME' })
    expect(await service.register({ code, username: 'Valid', password: 'short' })).toEqual({ ok: false, error: 'WEAK_PASSWORD' })
    expect(repo.invitations[0]!.usedAt).toBeNull()
  })

  it('refuses a taken pseudo (case-insensitive) and keeps the code usable', async () => {
    const { service } = setup()
    await seedUser(service, 'lelateam', 'Nami')
    const inv = await service.createInvitation(ROOT, 'lelateam')
    if (!inv.ok) throw new Error('setup')
    const reg = await service.register({ code: inv.invitation.code, username: 'nami', password: PW })
    expect(reg).toEqual({ ok: false, error: 'USERNAME_TAKEN' })
    const ok = await service.register({ code: inv.invitation.code, username: 'Nami2', password: PW })
    expect(ok.ok).toBe(true)
  })

  it('logs in with pseudo + password, rejects a wrong password', async () => {
    const { service } = setup()
    await seedUser(service, 'lelariva', 'Riva')
    const ok = await service.login('riva', PW)
    expect(ok.ok && ok.user.role).toBe('lelariva')
    expect(await service.login('Riva', `${PW}x`)).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' })
    expect(await service.login('ghost', PW)).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' })
  })

  it('env admin logs in and becomes an admin user in the base', async () => {
    const envPw = randomUUID()
    const { service, repo } = setup({ username: 'boss', password: envPw })
    const res = await service.login('boss', envPw)
    expect(res.ok && res.user.role).toBe('admin')
    expect(repo.users).toHaveLength(1)
    expect((await service.login('boss', envPw)).ok).toBe(true)
    expect(repo.users).toHaveLength(1)
  })

  it('logout ends the session; an expired session is rejected', async () => {
    const { service, repo } = setup()
    await seedUser(service, 'lelateam', 'Lulu')
    const res = await service.login('Lulu', PW)
    if (!res.ok) throw new Error('setup')
    await service.logout(res.token)
    expect(await service.authenticate(res.token)).toBeNull()

    const res2 = await service.login('Lulu', PW)
    if (!res2.ok) throw new Error('setup')
    for (const s of repo.sessions.values()) s.expiresAt = new Date(NOW.getTime() - 1)
    expect(await service.authenticate(res2.token)).toBeNull()
  })
})

describe('UserAuthService user management', () => {
  it('admin changes a role and the user sees it on next request', async () => {
    const { service } = setup()
    const user = await seedUser(service, 'lelateam', 'Yuumi')
    const login = await service.login('Yuumi', PW)
    if (!login.ok) throw new Error('setup')
    expect(await service.setRole(ROOT, user.id, 'lelariva')).toBe('OK')
    expect((await service.authenticate(login.token))?.role).toBe('lelariva')
  })

  it('lelateam cannot list users; lelariva cannot touch an admin; admin cannot demote or delete self', async () => {
    const { service } = setup()
    const admin = await seedUser(service, 'admin', 'Admin1')
    const riva = { id: 50, username: 'r', role: 'lelariva' as const }
    const team = { id: 51, username: 't', role: 'lelateam' as const }
    expect(await service.listUsers(team)).toBeNull()
    expect(await service.setRole(riva, admin.id, 'lelateam')).toBe('FORBIDDEN')
    expect(await service.deleteUser(riva, admin.id)).toBe('FORBIDDEN')
    expect(await service.setRole(admin, admin.id, 'lelateam')).toBe('SELF')
    expect(await service.deleteUser(admin, admin.id)).toBe('SELF')
  })

  it('deleting a user ends their sessions; list hides password hashes', async () => {
    const { service } = setup()
    const admin = await seedUser(service, 'admin', 'Admin1')
    const team = await seedUser(service, 'lelateam', 'Zoe')
    const login = await service.login('Zoe', PW)
    if (!login.ok) throw new Error('setup')
    const list = await service.listUsers(admin)
    expect(list?.map(u => u.username).sort()).toEqual(['Admin1', 'Zoe'])
    expect(JSON.stringify(list)).not.toContain('scrypt')
    expect(await service.deleteUser(admin, team.id)).toBe('OK')
    expect(await service.authenticate(login.token)).toBeNull()
  })

  it('lelariva sees and deletes lelateam only, and cannot promote', async () => {
    const { service } = setup()
    await seedUser(service, 'admin', 'Admin1')
    const riva = await seedUser(service, 'lelariva', 'Riva1')
    const otherRiva = await seedUser(service, 'lelariva', 'Riva2')
    const team = await seedUser(service, 'lelateam', 'Team1')
    const list = await service.listUsers(riva)
    expect(list?.map(u => u.username)).toEqual(['Team1'])
    expect(await service.setRole(riva, team.id, 'lelariva')).toBe('FORBIDDEN')
    expect(await service.setRole(riva, otherRiva.id, 'lelateam')).toBe('FORBIDDEN')
    expect(await service.deleteUser(riva, otherRiva.id)).toBe('FORBIDDEN')
    expect(await service.deleteUser(riva, team.id)).toBe('OK')
  })
})

describe('canManageUser', () => {
  it('admin manages every role, lelariva only lelateam, lelateam nobody', () => {
    expect(canManageUser('admin', 'admin')).toBe(true)
    expect(canManageUser('admin', 'lelariva')).toBe(true)
    expect(canManageUser('lelariva', 'lelateam')).toBe(true)
    expect(canManageUser('lelariva', 'lelariva')).toBe(false)
    expect(canManageUser('lelariva', 'admin')).toBe(false)
    expect(canManageUser('lelateam', 'lelateam')).toBe(false)
  })
})
