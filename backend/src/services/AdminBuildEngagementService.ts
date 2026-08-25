import {
  type BuildEngagementEntry,
  type BuildShareType,
  purgeOrphanBuildEngagement,
} from './BuildEngagementService.js'
import { getBuildVoteStatsBatch } from './BuildVoteService.js'
import { FileManager } from '../utils/fileManager.js'
import { join } from 'path'
import { getBuildIndex, type BuildRecord, buildsDir } from './BuildIndexService.js'

const BUILD_ENGAGEMENT_FILE = join(buildsDir, 'engagement.json')

type BuildEngagementStore = {
  builds: Record<string, BuildEngagementEntry>
}

export type AdminBuildEngagementRow = {
  buildId: string
  name: string
  author: string
  championName: string | null
  views: number
  shares: Record<BuildShareType, number>
  sharesTotal: number
  upvotes: number
  downvotes: number
  imports: number
  lastViewedAt: string | null
  lastSharedAt: string | null
  lastImportedAt: string | null
}

export type AdminBuildEngagementRecap = {
  totals: {
    builds: number
    views: number
    sharesLink: number
    sharesImage: number
    sharesImageWithMeta: number
    sharesTotal: number
    upvotes: number
    downvotes: number
    imports: number
  }
  rows: AdminBuildEngagementRow[]
}

async function readEngagementStore(): Promise<BuildEngagementStore> {
  const result = await FileManager.readJson<BuildEngagementStore>(BUILD_ENGAGEMENT_FILE)
  if (result.isErr()) return { builds: {} }
  const data = result.unwrap()
  return data && typeof data === 'object' && data.builds ? data : { builds: {} }
}

function readChampionName(build: BuildRecord | undefined): string | null {
  if (!build?.champion || typeof build.champion !== 'object') return null
  const champion = build.champion as { name?: unknown }
  return typeof champion.name === 'string' && champion.name.trim() ? champion.name.trim() : null
}

function rowFrom(
  buildId: string,
  meta: BuildRecord,
  eng: BuildEngagementEntry,
  upvotes: number,
  downvotes: number
): AdminBuildEngagementRow {
  const shares = {
    link: eng.shares.link ?? 0,
    image: eng.shares.image ?? 0,
    image_with_meta: eng.shares.image_with_meta ?? 0,
  }
  return {
    buildId,
    name: typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : '—',
    author: typeof meta.author === 'string' && meta.author.trim() ? meta.author.trim() : '—',
    championName: readChampionName(meta),
    views: eng.views ?? 0,
    shares,
    sharesTotal: shares.link + shares.image + shares.image_with_meta,
    upvotes,
    downvotes,
    imports: eng.imports ?? 0,
    lastViewedAt: eng.lastViewedAt ?? null,
    lastSharedAt: eng.lastSharedAt ?? null,
    lastImportedAt: eng.lastImportedAt ?? null,
  }
}

function hasEngagementStats(eng: BuildEngagementEntry): boolean {
  const sharesTotal =
    (eng.shares?.link ?? 0) + (eng.shares?.image ?? 0) + (eng.shares?.image_with_meta ?? 0)
  return (eng.views ?? 0) > 0 || sharesTotal > 0 || (eng.imports ?? 0) > 0
}

export async function getAdminBuildEngagementRecap(): Promise<AdminBuildEngagementRecap> {
  const { entries } = await getBuildIndex()
  const validIds = new Set(entries.map(entry => entry.id))
  await purgeOrphanBuildEngagement(validIds)

  const store = await readEngagementStore()
  const metaById = new Map(entries.map(entry => [entry.id, entry.build]))

  const buildIds = Object.entries(store.builds)
    .filter(([id, eng]) => metaById.has(id) && hasEngagementStats(eng))
    .map(([id]) => id)

  const voteStats = await getBuildVoteStatsBatch(buildIds)

  const rows = buildIds.map(id => {
    const eng = store.builds[id]!
    const votes = voteStats[id]
    return rowFrom(
      id,
      metaById.get(id)!,
      eng,
      votes?.upvotes ?? 0,
      votes?.downvotes ?? 0
    )
  })

  rows.sort((a, b) => {
    if (b.views !== a.views) return b.views - a.views
    if (b.sharesTotal !== a.sharesTotal) return b.sharesTotal - a.sharesTotal
    return a.name.localeCompare(b.name, 'fr')
  })

  const totals = rows.reduce(
    (acc, row) => {
      acc.builds += 1
      acc.views += row.views
      acc.sharesLink += row.shares.link
      acc.sharesImage += row.shares.image
      acc.sharesImageWithMeta += row.shares.image_with_meta
      acc.sharesTotal += row.sharesTotal
      acc.upvotes += row.upvotes
      acc.downvotes += row.downvotes
      acc.imports += row.imports
      return acc
    },
    {
      builds: 0,
      views: 0,
      sharesLink: 0,
      sharesImage: 0,
      sharesImageWithMeta: 0,
      sharesTotal: 0,
      upvotes: 0,
      downvotes: 0,
      imports: 0,
    }
  )

  return { totals, rows }
}
