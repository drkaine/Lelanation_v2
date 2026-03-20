/**
 * Materialized views: sync active_patches, refresh MVs, close_patch (archivage).
 * Plan: ne refresh que les patches actifs (en cours ou pas encore à max match).
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { loadMatchFilters } from './RiotConfigService.js'

/**
 * Extrait le patch (2 premiers segments) d'une game_version ex. "15.1.123.456" -> "15.1"
 */
export function patchFromGameVersion(gameVersion: string): string {
  const parts = gameVersion.split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return gameVersion
}

/**
 * Synchronise active_patches avec les patches présents dans les données brutes (matchs).
 * Une seule source de vérité : les patches actifs reflètent les matchs ingérés.
 * À appeler après ingestion pour que les nouveaux patches soient inclus dans le prochain refresh.
 */
export async function syncActivePatches(): Promise<number> {
  if (!isDatabaseConfigured()) return 0

  const rows = await prisma.$queryRaw<Array<{ patch: string }>>`
    SELECT DISTINCT (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) AS patch
    FROM matchs
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
  return added
}

/**
 * Sync active patches from match-filters config, then update hourly counters:
 * - games_number: COUNT(*) from matchs per patch
 * - game_number_max: maxMatches from config
 * - is_current: true while patch still collecting, false once target reached
 */
export async function syncActivePatchesFromConfigAndCounts(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
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

  const rows = await prisma.$queryRaw<Array<{ patch: string; cnt: bigint | number }>>`
    SELECT
      (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) AS patch,
      COUNT(*) AS cnt
    FROM matchs
    GROUP BY 1
  `

  for (const r of rows) {
    const patch = (r.patch ?? '').trim()
    if (!patch) continue
    const count = typeof r.cnt === 'bigint' ? Number(r.cnt) : Number(r.cnt ?? 0)
    const existing = await prisma.activePatch.findUnique({
      where: { gameVersion: patch },
      select: { gameNumberMax: true },
    })
    const max = existing?.gameNumberMax ?? 0
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

  return touched
}

/**
 * Lance le refresh des vues matérialisées (CONCURRENTLY).
 * À appeler périodiquement (ex. toutes les 2h ou après chaque batch d'agrégation, selon charge).
 */
export async function refreshAllMaterializedViews(): Promise<void> {
  if (!isDatabaseConfigured()) return
  await prisma.$executeRawUnsafe('SELECT refresh_all_materialized_views()')
}

/**
 * Clôture un patch : archivage des agrégats, retrait de active_patches, suppression des données brutes.
 * À appeler pour un patch "passé" qui a atteint son max de matchs (match-filters.json).
 */
export async function closePatch(patch: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  await prisma.$executeRaw`SELECT close_patch(${patch})`
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
