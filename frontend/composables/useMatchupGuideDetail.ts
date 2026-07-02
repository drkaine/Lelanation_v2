import type { MatchupGuide } from '@lelanation/shared-types'
import { apiUrl } from '~/utils/apiUrl'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { ensureMatchupGuideBuildHydrated } from '~/utils/matchupGuideBuildResolve'

export async function fetchMatchupGuideById(
  id: string,
  fetcher?: (path: string) => Promise<MatchupGuide>
): Promise<MatchupGuide | null> {
  if (import.meta.client) {
    const guideStore = useMatchupGuideStore()
    const local = guideStore.getSavedGuides().find(g => g.id === id)
    if (local) return ensureMatchupGuideBuildHydrated(local)
  }

  try {
    const doFetch = fetcher ?? ((path: string) => $fetch<MatchupGuide>(apiUrl(path)))
    const guide = await doFetch(`/api/matchup-guides/${encodeURIComponent(id)}`)
    return guide ? ensureMatchupGuideBuildHydrated(guide) : null
  } catch {
    return null
  }
}

export function guideDisplayDate(guide: MatchupGuide): string {
  if (guideDateIsUpdate(guide)) return guide.updatedAt
  return guide.createdAt || guide.updatedAt || ''
}

export function guideDateIsUpdate(guide: MatchupGuide): boolean {
  if (!guide.updatedAt || !guide.createdAt) return Boolean(guide.updatedAt)
  return new Date(guide.updatedAt).getTime() > new Date(guide.createdAt).getTime()
}
