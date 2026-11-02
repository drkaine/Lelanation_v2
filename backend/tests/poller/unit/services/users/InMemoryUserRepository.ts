import type {
  InvitationRecord,
  NewUser,
  UserRecord,
  UserRepository,
} from '../../../../../src/services/users/UserRepository.js'

/** In-memory UserRepository for unit tests (no DB). */
export class InMemoryUserRepository implements UserRepository {
  users: UserRecord[] = []
  invitations: InvitationRecord[] = []
  sessions = new Map<string, { userId: number; expiresAt: Date }>()
  private nextId = 1

  async findUserByUsername(username: string) {
    const key = username.toLowerCase()
    return this.users.find(u => u.username.toLowerCase() === key) ?? null
  }

  async findUserById(id: number) {
    return this.users.find(u => u.id === id) ?? null
  }

  async createUser(user: NewUser) {
    const record: UserRecord = { ...user, id: this.nextId++, createdAt: new Date() }
    this.users.push(record)
    return record
  }

  async updateUser(id: number, patch: Partial<Pick<UserRecord, 'passwordHash' | 'role'>>) {
    const user = this.users.find(u => u.id === id)
    if (user) Object.assign(user, patch)
  }

  async deleteUser(id: number) {
    this.users = this.users.filter(u => u.id !== id)
    await this.deleteUserSessions(id)
  }

  async listUsers() {
    return [...this.users]
  }

  async createInvitation(invitation: InvitationRecord) {
    this.invitations.push({ ...invitation })
  }

  async consumeInvitation(code: string, now: Date) {
    const inv = this.invitations.find(i => i.code === code && !i.usedAt && i.expiresAt > now)
    if (!inv) return null
    inv.usedAt = now
    return { ...inv }
  }

  async attachInvitationUser(code: string, userId: number) {
    const inv = this.invitations.find(i => i.code === code)
    if (inv) inv.usedBy = userId
  }

  async releaseInvitation(code: string) {
    const inv = this.invitations.find(i => i.code === code)
    if (inv) inv.usedAt = null
  }

  async listPendingInvitations(now: Date) {
    return this.invitations.filter(i => !i.usedAt && i.expiresAt > now)
  }

  async deleteInvitation(code: string) {
    this.invitations = this.invitations.filter(i => i.code !== code)
  }

  async createSession(tokenHash: string, userId: number, expiresAt: Date) {
    this.sessions.set(tokenHash, { userId, expiresAt })
  }

  async findSession(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash)
  }

  async deleteUserSessions(userId: number) {
    for (const [hash, s] of this.sessions) if (s.userId === userId) this.sessions.delete(hash)
  }
}
