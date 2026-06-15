import type { YouTubeVideo } from '~/types/youtube'
import { listAllYouTubeVideosFromDisk } from '~/utils/youtubeCatalog'
import {
  listChampionsFromIndex,
  readCurrentGameVersion,
  resolveFrontendRoot,
} from '~/utils/seoCatalog'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'

type TierRow = {
  rank: number
  championId: number
  tier: string
  mainRole: string
}

type EnrichedTierRow = TierRow & {
  championName: string
  championImage: string
}

const HOME_ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

function normalizeRole(role: string): string {
  const r = role.trim().toUpperCase()
  return r === 'UTILITY' ? 'SUPPORT' : r
}

function resolveBackendBase(): string {
  const configured = String(useRuntimeConfig().public.apiBase || '').trim()
  if (configured) return configured.replace(/\/$/, '')
  return 'http://127.0.0.1:3500'
}

function sortVideosByDate(videos: YouTubeVideo[]): YouTubeVideo[] {
  return [...videos].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

export default defineEventHandler(async () => {
  const frontendRoot = resolveFrontendRoot()
  const fallbackPatch = readCurrentGameVersion(frontendRoot)
  const apiBase = resolveBackendBase()

  const [recentPayload, tierPayload] = await Promise.all([
    $fetch<{ totalBuilds?: number; builds?: unknown[] }>(
      `${apiBase}/api/builds/recent?limit=6`
    ).catch(() => ({ totalBuilds: 0, builds: [] as unknown[] })),
    $fetch<{ patch?: string; rows?: TierRow[] }>(
      `${apiBase}/api/stats/tier-list?rankTier=all`
    ).catch(() => ({ rows: [] as TierRow[] })),
  ])

  const patch = tierPayload.patch ?? fallbackPatch
  const overviewPayload = await $fetch<{ totalMatches?: number }>(
    `${apiBase}/api/stats/overview?version=${encodeURIComponent(patch)}`
  ).catch(() => ({ totalMatches: 0 }))
  const tierRows = tierPayload.rows ?? []
  const championIndex = listChampionsFromIndex(frontendRoot, fallbackPatch)
  const championByKey = new Map(
    championIndex.map(champion => [Number(champion.key), champion] as const)
  )

  const enrichTierRow = (row: TierRow): EnrichedTierRow => {
    const champion = championByKey.get(row.championId)
    const championName = champion?.name ?? String(row.championId)
    const championImage =
      champion?.image?.full ?? (champion?.id ? `${champion.id}.png` : `${row.championId}.png`)
    return {
      ...row,
      championName,
      championImage,
    }
  }

  const tierByRole = HOME_ROLES.map(role => ({
    role,
    champions: tierRows
      .filter(row => normalizeRole(row.mainRole) === role)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5)
      .map(enrichTierRow),
  }))

  const sortedVideos = sortVideosByDate(listAllYouTubeVideosFromDisk(frontendRoot))

  return {
    patch,
    season: lolSeasonFromGameVersion(patch),
    recentBuilds: recentPayload.builds ?? [],
    totalBuilds: recentPayload.totalBuilds ?? 0,
    tierByRole,
    patchMatchCount: overviewPayload.totalMatches ?? 0,
    videoCount: sortedVideos.length,
    latestVideos: sortedVideos.slice(0, 6),
  }
})
