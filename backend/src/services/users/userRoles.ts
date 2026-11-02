export const USER_ROLES = ['admin', 'lelariva', 'lelateam'] as const

export type UserRole = (typeof USER_ROLES)[number]

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

/** Roles an actor may hand out through an invitation code. */
export function invitableRoles(role: UserRole): UserRole[] {
  if (role === 'admin') return [...USER_ROLES]
  if (role === 'lelariva') return ['lelateam']
  return []
}

/** Publish (shared → public) or delete a shared build. Creating / editing is open to every role. */
export function canManageSharedBuilds(role: UserRole): boolean {
  return role === 'admin' || role === 'lelariva'
}

/** Who may see, re-role or delete whom: admin → everyone, lelariva → lelateam only. */
export function canManageUser(actorRole: UserRole, targetRole: UserRole): boolean {
  return invitableRoles(actorRole).includes(targetRole)
}
