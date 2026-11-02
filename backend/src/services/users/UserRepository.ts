import type { UserRole } from './userRoles.js'

export interface UserRecord {
  id: number
  username: string
  passwordHash: string
  role: UserRole
  createdAt: Date
}

export type NewUser = Pick<UserRecord, 'username' | 'passwordHash' | 'role'>

export interface InvitationRecord {
  code: string
  role: UserRole
  createdBy: number | null
  createdAt: Date
  expiresAt: Date
  usedAt: Date | null
  usedBy: number | null
}

/** Storage port for users, invitations and sessions (Postgres in prod, in-memory in tests). */
export interface UserRepository {
  /** Case-insensitive lookup. */
  findUserByUsername(username: string): Promise<UserRecord | null>
  findUserById(id: number): Promise<UserRecord | null>
  createUser(user: NewUser): Promise<UserRecord>
  updateUser(id: number, patch: Partial<Pick<UserRecord, 'passwordHash' | 'role'>>): Promise<void>
  /** Also removes the user's sessions. */
  deleteUser(id: number): Promise<void>
  listUsers(): Promise<UserRecord[]>

  createInvitation(invitation: InvitationRecord): Promise<void>
  /** Atomically marks an unused, unexpired invitation as used. Null when not consumable. */
  consumeInvitation(code: string, now: Date): Promise<InvitationRecord | null>
  attachInvitationUser(code: string, userId: number): Promise<void>
  /** Undo a consume (user creation failed). */
  releaseInvitation(code: string): Promise<void>
  listPendingInvitations(now: Date): Promise<InvitationRecord[]>
  deleteInvitation(code: string): Promise<void>

  createSession(tokenHash: string, userId: number, expiresAt: Date): Promise<void>
  findSession(tokenHash: string): Promise<{ userId: number; expiresAt: Date } | null>
  deleteSession(tokenHash: string): Promise<void>
  deleteUserSessions(userId: number): Promise<void>
}
