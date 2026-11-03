import type { Build } from '@lelanation/shared-types'

export interface BuildCardTopState {
  author: string
  visibility: 'public' | 'private'
  teamShared: boolean
  /** false quand la carte affiche un build passé en prop (côté inactif) : rien ne doit écrire dans le build courant. */
  editable: boolean
}

/** Auteur et visibilité affichés en haut de la carte : ceux du build montré, pas du build courant. */
export function buildCardTopState(
  shownBuild: Build | null | undefined,
  currentBuild: Build | null | undefined
): BuildCardTopState {
  const source = shownBuild ?? currentBuild
  return {
    author: source?.author ?? '',
    visibility: source?.visibility === 'private' ? 'private' : 'public',
    teamShared: source?.teamShared === true,
    editable: !shownBuild,
  }
}
