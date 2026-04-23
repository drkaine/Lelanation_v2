import { prisma, isDatabaseConfigured } from '../db.js'
import { loadMatchFilters } from './RiotConfigService.js'

let activePatchTail: Promise<unknown> = Promise.resolve()

function enqueueActivePatchUpdate<T>(fn: () => Promise<T>): Promise<T> {
  const next = activePatchTail.then(fn) as Promise<T>
  activePatchTail = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

async function applyActivePatchGameCountsFromDb(): Promise<void> {
  if (!isDatabaseConfigured()) return
  const rows = await prisma.$queryRaw<Array<{ patch: string; cnt: bigint | number }>>`
    WITH ingest_per_patch AS (
      SELECT
        (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) AS patch,
        COUNT(*)::bigint AS cnt
      FROM ingest_matchs
      WHERE COALESCE(NULLIF(TRIM(game_version), ''), '') <> ''
        AND COALESCE(NULLIF(TRIM(rank_tier), ''), 'UNRANKED') <> 'UNRANKED'
      GROUP BY 1
    ),
    agg_per_patch AS (
      SELECT
        (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) AS patch,
        COALESCE(SUM(count_match), 0)::bigint AS cnt
      FROM agg_match_outcome_stats
      WHERE rank_tier <> 'UNRANKED'
        AND COALESCE(NULLIF(TRIM(game_version), ''), '') <> ''
      GROUP BY 1
    ),
    merged AS (
      SELECT
        COALESCE(i.patch, a.patch) AS patch,
        CASE
          WHEN COALESCE(i.cnt, 0) > 0 THEN i.cnt
          ELSE COALESCE(a.cnt, 0)
        END AS cnt
      FROM ingest_per_patch i
      FULL JOIN agg_per_patch a ON a.patch = i.patch
    )
    SELECT patch, cnt
    FROM merged
    WHERE COALESCE(NULLIF(TRIM(patch), ''), '') <> ''
  `

  const countByPatch = new Map<string, number>()
  for (const r of rows) {
    const p = (r.patch ?? '').trim()
    if (!p) continue
    countByPatch.set(p, typeof r.cnt === 'bigint' ? Number(r.cnt) : Number(r.cnt ?? 0))
  }

  const existing = await prisma.activePatch.findMany({
    select: { gameVersion: true, gameNumberMax: true, archivedAt: true },
  })

  const patches = new Set<string>()
  for (const r of existing) patches.add(r.gameVersion.trim())
  for (const p of countByPatch.keys()) patches.add(p)

  for (const patch of patches) {
    const row = existing.find((e) => e.gameVersion === patch)
    if (row?.archivedAt != null) continue

    const count = countByPatch.get(patch) ?? 0
    const max = row?.gameNumberMax ?? 0
    await prisma.activePatch.upsert({
      where: { gameVersion: patch },
      create: {
        gameVersion: patch,
        gamesNumber: count,
        gameNumberMax: max,
        isCurrent: max <= 0 ? true : count < max,
      },
      update: {
        gamesNumber: count,
        isCurrent: max <= 0 ? true : count < max,
      },
    })
  }
}

async function syncActivePatchesImpl(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ patch: string }>>`
    SELECT DISTINCT (split_part(v.game_version, '.', 1) || '.' || split_part(v.game_version, '.', 2)) AS patch
    FROM (
      SELECT game_version FROM ingest_matchs
      UNION
      SELECT game_version FROM agg_match_outcome_stats
    ) v
    WHERE COALESCE(TRIM(v.game_version), '') <> ''
  `
  let added = 0
  for (const { patch } of rows) {
    if (!patch) continue
    await prisma.activePatch.upsert({
      where: { gameVersion: patch },
      create: { gameVersion: patch, isCurrent: true },
      update: {},
    })
    added++
  }
  await applyActivePatchGameCountsFromDb()
  return added
}

export async function syncActivePatches(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  return enqueueActivePatchUpdate(() => syncActivePatchesImpl())
}

async function syncActivePatchesFromConfigAndCountsImpl(): Promise<number> {
  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) return 0
  const filters = filtersRes.unwrap()

  let touched = 0
  for (const v of filters.versions) {
    const patch = (v.version ?? '').trim()
    if (!patch) continue
    const max = Math.max(0, Number(v.maxMatches ?? 0))
    await prisma.activePatch.upsert({
      where: { gameVersion: patch },
      create: {
        gameVersion: patch,
        gameNumberMax: max,
        gamesNumber: 0,
        isCurrent: true,
      },
      update: { gameNumberMax: max },
    })
    touched++
  }

  await applyActivePatchGameCountsFromDb()
  return touched
}

export async function syncActivePatchesFromConfigAndCounts(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  return enqueueActivePatchUpdate(() => syncActivePatchesFromConfigAndCountsImpl())
}

export async function ensureActivePatchVersion(patch: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  const value = (patch ?? '').trim()
  if (!value) return
  await prisma.activePatch.upsert({
    where: { gameVersion: value },
    create: { gameVersion: value, isCurrent: true },
    update: {},
  })
}
