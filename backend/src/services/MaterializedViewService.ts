/**
 * Materialized views: sync active_patches, refresh MVs, close_patch (archivage).
 * Plan: ne refresh que les patches actifs (en cours ou pas encore à max match).
 */
import { prisma, isDatabaseConfigured } from '../db.js'

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
