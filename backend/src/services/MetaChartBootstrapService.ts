import { getMatchesByVersionStats } from './StatsOverviewService.js'
import { getTierList, type GetTierListOptions, type GetTierListResult } from './TierListService.js'

export interface MetaChartBootstrapResult {
  versions: Array<{ version: string; matchCount: number }>
  tierList: GetTierListResult | null
  refTierList: GetTierListResult | null
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(x => Number(x))
  const pb = b.split('.').map(x => Number(x))
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const da = Number.isFinite(pa[i]!) ? (pa[i] as number) : 0
    const db = Number.isFinite(pb[i]!) ? (pb[i] as number) : 0
    if (da !== db) return db - da
  }
  return b.localeCompare(a)
}

export async function getMetaChartBootstrap(options: {
  patch?: string | null
  refPatch?: string | null
  rankTier?: GetTierListOptions['rankTier']
  role?: string | null
}): Promise<MetaChartBootstrapResult> {
  const rankTier = options.rankTier ?? 'all'
  const rankTierForVersions =
    rankTier === 'all' ? null : Array.isArray(rankTier) ? rankTier : rankTier

  const versionsRaw = await getMatchesByVersionStats(rankTierForVersions)
  const versions = [...versionsRaw]
    .filter(v => v?.version && Number(v.matchCount) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))

  let currentPatch = options.patch?.trim() || null
  if (!currentPatch && versions.length > 0) {
    currentPatch = versions[0]!.version
  }

  let refPatch = options.refPatch?.trim() || null
  if (!refPatch && currentPatch && versions.length > 1) {
    const idx = versions.findIndex(v => v.version === currentPatch)
    refPatch = idx >= 0 ? versions[idx + 1]?.version ?? null : versions[1]?.version ?? null
  }

  const tierListOptions: GetTierListOptions = {
    patch: currentPatch || undefined,
    rankTier,
    role: options.role?.trim() || null,
  }

  const shouldLoadRef = Boolean(refPatch && currentPatch && refPatch !== currentPatch)

  const [tierList, refTierList] = await Promise.all([
    getTierList(tierListOptions),
    shouldLoadRef
      ? getTierList({
          ...tierListOptions,
          patch: refPatch!,
        })
      : Promise.resolve(null),
  ])

  return {
    versions,
    tierList,
    refTierList,
  }
}
