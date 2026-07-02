import type { MatchupGuide } from '@lelanation/shared-types'
import { fetchPublicBuildDetail } from '~/composables/useBuildDetailFetch'
import { getMatchupGuideBuildId } from '~/utils/matchupGuideByBuild'
import { hydrateBuild } from '~/utils/buildSerialize'

/** Ensure `guide.build` is populated from API when only `buildId` is stored on disk. */
export async function ensureMatchupGuideBuildHydrated(guide: MatchupGuide): Promise<MatchupGuide> {
  if (guide.build) return guide
  const buildId = getMatchupGuideBuildId(guide)
  if (!buildId) return guide
  const raw = await fetchPublicBuildDetail(buildId)
  if (!raw) return guide
  return {
    ...guide,
    buildId,
    build: hydrateBuild(raw),
  }
}
