import type pg from 'pg'
import type { InvitationRecord, NewUser, UserRecord, UserRepository } from './UserRepository.js'
import { isUserRole, type UserRole } from './userRoles.js'

type Row = Record<string, unknown>

function role(value: unknown): UserRole {
  if (!isUserRole(value)) throw new Error(`Unknown role in base: ${String(value)}`)
  return value
}

function toUser(row: Row): UserRecord {
  return {
    id: Number(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    role: role(row.role),
    createdAt: new Date(String(row.created_at)),
  }
}

function dateOrNull(value: unknown): Date | null {
  return value == null ? null : new Date(String(value))
}

function toInvitation(row: Row): InvitationRecord {
  return {
    code: String(row.code),
    role: role(row.role),
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
    usedAt: dateOrNull(row.used_at),
    usedBy: row.used_by == null ? null : Number(row.used_by),
  }
}

/** Tables from migration 0047 (app_users, app_user_invitations, app_user_sessions). */
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly pool: pg.Pool) {}

  private async rows(sql: string, params: unknown[] = []): Promise<Row[]> {
    const res = await this.pool.query(sql, params)
    return res.rows as Row[]
  }

  async findUserByUsername(username: string) {
    const [row] = await this.rows('SELECT * FROM app_users WHERE lower(username) = lower($1)', [username])
    return row ? toUser(row) : null
  }

  async findUserById(id: number) {
    const [row] = await this.rows('SELECT * FROM app_users WHERE id = $1', [id])
    return row ? toUser(row) : null
  }

  async createUser(user: NewUser) {
    const [row] = await this.rows(
      'INSERT INTO app_users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING *',
      [user.username, user.passwordHash, user.role]
    )
    if (!row) throw new Error('INSERT app_users returned no row')
    return toUser(row)
  }

  async updateUser(id: number, patch: Partial<Pick<UserRecord, 'passwordHash' | 'role'>>) {
    await this.pool.query(
      'UPDATE app_users SET password_hash = COALESCE($2, password_hash), role = COALESCE($3, role) WHERE id = $1',
      [id, patch.passwordHash ?? null, patch.role ?? null]
    )
  }

  async deleteUser(id: number) {
    // Sessions cascade.
    await this.pool.query('DELETE FROM app_users WHERE id = $1', [id])
  }

  async listUsers() {
    return (await this.rows('SELECT * FROM app_users ORDER BY created_at')).map(toUser)
  }

  async createInvitation(inv: InvitationRecord) {
    await this.pool.query(
      'INSERT INTO app_user_invitations (code, role, created_by, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [inv.code, inv.role, inv.createdBy, inv.createdAt, inv.expiresAt]
    )
  }

  async consumeInvitation(code: string, now: Date) {
    const [row] = await this.rows(
      `UPDATE app_user_invitations SET used_at = $2
       WHERE code = $1 AND used_at IS NULL AND expires_at > $2 RETURNING *`,
      [code, now]
    )
    return row ? toInvitation(row) : null
  }

  async attachInvitationUser(code: string, userId: number) {
    await this.pool.query('UPDATE app_user_invitations SET used_by = $2 WHERE code = $1', [code, userId])
  }

  async releaseInvitation(code: string) {
    await this.pool.query('UPDATE app_user_invitations SET used_at = NULL WHERE code = $1', [code])
  }

  async listPendingInvitations(now: Date) {
    const rows = await this.rows(
      'SELECT * FROM app_user_invitations WHERE used_at IS NULL AND expires_at > $1 ORDER BY created_at DESC',
      [now]
    )
    return rows.map(toInvitation)
  }

  async deleteInvitation(code: string) {
    await this.pool.query('DELETE FROM app_user_invitations WHERE code = $1', [code])
  }

  async createSession(tokenHash: string, userId: number, expiresAt: Date) {
    await this.pool.query('INSERT INTO app_user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
      tokenHash,
      userId,
      expiresAt,
    ])
  }

  async findSession(tokenHash: string) {
    const [row] = await this.rows('SELECT user_id, expires_at FROM app_user_sessions WHERE token_hash = $1', [tokenHash])
    return row ? { userId: Number(row.user_id), expiresAt: new Date(String(row.expires_at)) } : null
  }

  async deleteSession(tokenHash: string) {
    await this.pool.query('DELETE FROM app_user_sessions WHERE token_hash = $1', [tokenHash])
  }

  async deleteUserSessions(userId: number) {
    await this.pool.query('DELETE FROM app_user_sessions WHERE user_id = $1', [userId])
  }
}
