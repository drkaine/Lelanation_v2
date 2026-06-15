import type { Build } from '@lelanation/shared-types'
import { apiUrl } from '~/utils/apiUrl'
import { hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'

/** Charge un build public pour SSR / prerender (pages détail). */
export async function fetchPublicBuildDetail(buildId: string): Promise<Build | null> {
  if (!buildId) return null
  try {
    const buildData = await $fetch<unknown>(apiUrl(`/api/builds/${encodeURIComponent(buildId)}`))
    const buildToMigrate = isStoredBuild(buildData) ? hydrateBuild(buildData) : (buildData as Build)
    const { migrated } = await migrateBuildToCurrent(buildToMigrate)
    return migrated
  } catch {
    return null
  }
}
