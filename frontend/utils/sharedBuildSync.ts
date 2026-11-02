import type { UserRole } from '~/utils/userSession'
import { canManageSharedBuilds } from '~/utils/userSession'
import { buildEditHeaders } from '~/utils/buildApi'

type Visibility = 'public' | 'private'
type SyncState = { visibility: Visibility; teamShared?: boolean }

export type VisibilitySyncAction = 'saveShared' | 'savePublic' | 'deletePublic' | 'none'

/**
 * Appel serveur à faire à l'enregistrement.
 * Un build d'équipe passe toujours par /api/shared-builds : le serveur publie ou dépublie la copie publique.
 */
export function visibilitySyncAction(
  prev: SyncState | null,
  next: SyncState
): VisibilitySyncAction {
  if (next.teamShared) return 'saveShared'
  if (next.visibility === 'public') return 'savePublic'
  return prev?.visibility === 'public' ? 'deletePublic' : 'none'
}

/**
 * État des contrôles de la carte :
 * - case « Équipe » visible pour tout compte connecté ;
 * - plus décochable une fois le build enregistré dans l'espace équipe (seule la suppression l'en retire) ;
 * - visibilité verrouillée sur un build d'équipe, sauf pour admin / lelariva.
 */
export function teamShareControls(input: {
  role: UserRole | null
  teamShared: boolean
  savedTeamShared: boolean
}): { showTeamShare: boolean; teamShareLocked: boolean; visibilityLocked: boolean } {
  const { role, teamShared, savedTeamShared } = input
  return {
    showTeamShare: role !== null,
    teamShareLocked: savedTeamShared,
    visibilityLocked: teamShared && !canManageSharedBuilds(role),
  }
}

/** Cocher « Équipe » : un compte lelateam repasse le build en privé. */
export function visibilityAfterTeamShare(
  visibility: Visibility,
  role: UserRole | null
): Visibility {
  return canManageSharedBuilds(role) ? visibility : 'private'
}

/** En-têtes pour /api/shared-builds : Bearer du compte + secret d'édition du build d'origine. */
export function sharedBuildHeaders(token: string, editSecret?: string): Record<string, string> {
  return { ...buildEditHeaders(editSecret), Authorization: `Bearer ${token}` }
}

/** Onglet Builds team : tout membre modifie ; seuls admin / lelariva changent la visibilité ou suppriment. */
export function teamBuildActions(role: UserRole | null): {
  canEdit: boolean
  canChangeVisibility: boolean
  canDelete: boolean
} {
  const manager = canManageSharedBuilds(role)
  return { canEdit: role !== null, canChangeVisibility: manager, canDelete: manager }
}

/** Bascule de visibilité d'un build d'équipe → endpoint /api/shared-builds/:id/<action>. */
export function teamVisibilityRequest(visibility: Visibility | undefined): 'publish' | 'unpublish' {
  return visibility === 'public' ? 'unpublish' : 'publish'
}

/** Badge « Lelariva » : build d'équipe (même privé, pour l'export image) ou sa copie publique. */
export function showLelarivaBadge(
  build: { lelarivaBadge?: boolean; teamShared?: boolean } | null | undefined
): boolean {
  return build?.lelarivaBadge === true || build?.teamShared === true
}
