import type { Build, StoredBuild } from '@lelanation/shared-types'

/**
 * Version serveur d'un build d'équipe à éditer (toujours la plus récente).
 * null si ce n'est pas un build d'équipe, si l'appel échoue ou si l'id ne correspond pas.
 */
export async function fetchTeamBuildForEdit(
  id: string,
  fetcher: (url: string) => Promise<Response>
): Promise<(Build | StoredBuild) | null> {
  try {
    const res = await fetcher(`/api/shared-builds/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const build = (await res.json()) as (Build | StoredBuild) & { id?: string }
    if (build?.id !== id) return null
    return { ...build, teamShared: true }
  } catch {
    return null
  }
}
