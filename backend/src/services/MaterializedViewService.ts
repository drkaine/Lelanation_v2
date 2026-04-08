/**
 * Materialized views: sync active_patches, refresh MVs, close_patch (archivage).
 * Plan: ne refresh que les patches actifs (en cours ou pas encore à max match).
 *
 * DBeaver / verrous : un `REFRESH MATERIALIZED VIEW` sans CONCURRENTLY prend un verrou exclusif
 * et bloque les lectures sur la vue ; deux rafraîchissements (ex. appli + console SQL) sur la même
 * vue s’attendent mutuellement. Préférer `REFRESH MATERIALIZED VIEW CONCURRENTLY` (une vue à la fois),
 * ou arrêter le refresh applicatif pendant une maintenance manuelle ; sinon `pg_stat_activity` pour
 * voir les sessions en attente (`wait_event`).
 */
type MvRefreshTimingRow = {
  name: string
  ms: number
  how: 'concurrent' | 'blocking' | 'skipped_dup' | 'skipped_missing'
}
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { prisma, isDatabaseConfigured } from '../db.js'
import { normalizeGameVersionToMajorMinor } from '../utils/gameVersion.js'
import { loadMatchFilters } from './RiotConfigService.js'

const MV_NAMES = [
  'mv_champion_core_stats',
  'mv_champion_vs_stats',
  'mv_champion_duo_role_stats',
  'mv_botlane_duo_vs_duo_stats',
  'mv_team_core_stats',
  'mv_champion_first_objectif_stats',
  'mv_champion_objectif_stats',
  'mv_champion_vision_stats',
  'mv_champion_combat_stats',
  'mv_champion_matchup_stats',
  'mv_champion_challenge_stats',
  'mv_champion_shard_solo_stats',
  'mv_champion_runes_solo_stats',
  'mv_champion_shard_stats',
  'mv_champion_runes_stats',
  'mv_champion_item_solo_stats',
  'mv_champion_item_stats',
  'mv_champion_spell_solo_stats',
  'mv_champion_summoner_spells',
  'mv_champion_bucket',
  'mv_champion_bans_by_banner',
  'mv_team_bucket',
  'mv_match_outcome_stats',
  'mv_champion_side_stats',
  'mv_champion_summoner_spell_pair_stats',
  'mv_champion_item_starter_set_stats',
] as const
const missingViews = new Set<string>()

async function refreshAllMaterializedViewsWithoutConcurrently(): Promise<MvRefreshTimingRow[]> {
  const timings: MvRefreshTimingRow[] = []
  for (const mvName of MV_NAMES) {
    if (missingViews.has(mvName)) continue
    const t0 = Date.now()
    try {
      // Prefer CONCURRENTLY to avoid blocking readers (admin/DBeaver).
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${mvName}`)
      timings.push({ name: mvName, ms: Date.now() - t0, how: 'concurrent' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Historical data may produce duplicate rows for some MV unique keys.
      // Skip only that MV and continue refreshing the others.
      if (message.includes('23505') || message.includes('could not create unique index')) {
        timings.push({ name: mvName, ms: Date.now() - t0, how: 'skipped_dup' })
        continue
      }
      // Some views may require an initial non-concurrent refresh (not yet populated / no suitable index).
      if (
        message.includes('CONCURRENTLY') ||
        message.includes('55000') ||
        message.includes('has not been populated') ||
        message.includes('not been populated')
      ) {
        try {
          await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${mvName}`)
          timings.push({ name: mvName, ms: Date.now() - t0, how: 'blocking' })
          continue
        } catch (fallbackErr) {
          const fallbackMessage =
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
          if (
            fallbackMessage.includes('23505') ||
            fallbackMessage.includes('could not create unique index')
          ) {
            timings.push({ name: mvName, ms: Date.now() - t0, how: 'skipped_dup' })
            continue
          }
          if (fallbackMessage.includes('42P01') || fallbackMessage.includes('does not exist')) {
            missingViews.add(mvName)
            timings.push({ name: mvName, ms: Date.now() - t0, how: 'skipped_missing' })
            console.warn('[MaterializedViewService] Missing MV skipped during refresh:', mvName)
            continue
          }
          throw fallbackErr
        }
      }
      // Schema drift / partial migration: skip missing MV and keep the poller running.
      if (message.includes('42P01') || message.includes('does not exist')) {
        missingViews.add(mvName)
        timings.push({ name: mvName, ms: Date.now() - t0, how: 'skipped_missing' })
        console.warn('[MaterializedViewService] Missing MV skipped during refresh:', mvName)
        continue
      }
      throw err
    }
  }
  return timings
}

async function getUnpopulatedMaterializedViews(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ matviewname: string; ispopulated: boolean }>>`
    SELECT matviewname, ispopulated
    FROM pg_matviews
    WHERE schemaname = 'public' AND matviewname LIKE 'mv_%'
  `
  return new Set(rows.filter((r) => !r.ispopulated).map((r) => r.matviewname))
}

/**
 * Après CREATE ... WITH NO DATA (migrate), PostgreSQL refuse tout SELECT sur la VM tant qu’un
 * REFRESH blocking n’a pas eu lieu. Appeler au boot API et en tête de refresh planifié.
 */
export async function ensureMaterializedViewsPopulated(): Promise<void> {
  if (!isDatabaseConfigured()) return
  const unpopulated = await getUnpopulatedMaterializedViews()
  if (unpopulated.size === 0) return
  console.warn(
    '[MaterializedViewService] Unpopulated MVs (post-migrate?):',
    [...unpopulated].join(', ')
  )
  // Core must be populated first because many satellite MVs depend on its key mapping.
  if (unpopulated.has('mv_champion_core_stats')) {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW mv_champion_core_stats')
    unpopulated.delete('mv_champion_core_stats')
  }
  for (const mvName of MV_NAMES) {
    if (!unpopulated.has(mvName)) continue
    try {
      await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW ${mvName}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[MaterializedViewService] REFRESH ${mvName} failed:`, msg)
    }
  }
}

/**
 * Extrait le patch (2 premiers segments) d'une game_version ex. "15.1.123.456" -> "15.1"
 */
export function patchFromGameVersion(gameVersion: string): string {
  const p = normalizeGameVersionToMajorMinor(gameVersion)
  return p || gameVersion
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

/** Un seul refresh à la fois : évite deux `debut` sans `fin` cohérent si poller + snapshot (ou autres) se chevauchent. */
let mvRefreshInFlight: Promise<void> | null = null

async function runRefreshAllMaterializedViewsOnce(): Promise<void> {
  const t0 = Date.now()
  await appendUnifiedLog({
    section: 'db',
    type: 'debut',
    script: 'mv_refresh',
    message: 'Début refresh des vues matérialisées',
  })
  try {
    await ensureMaterializedViewsPopulated()
    const mvTimings = await refreshAllMaterializedViewsWithoutConcurrently()
    const durationMs = Date.now() - t0
    const missingCount = missingViews.size
    const slowest = [...mvTimings].sort((a, b) => b.ms - a.ms)[0]
    await appendUnifiedLog({
      section: 'db',
      type: 'fin',
      script: 'mv_refresh',
      message: `Fin refresh des vues matérialisées (${Math.round(durationMs / 1000)}s)`,
      json: {
        durationMs,
        tablesDefined: MV_NAMES.length,
        missingSkipped: missingCount,
        tablesTouched: MV_NAMES.length - missingCount,
        mvTimings,
        slowestMv: slowest ? { name: slowest.name, ms: slowest.ms, how: slowest.how } : undefined,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await appendUnifiedLog({
      section: 'db',
      type: 'erreur',
      script: 'mv_refresh',
      message: msg,
      json: { durationMs: Date.now() - t0, queryHint: 'REFRESH MATERIALIZED VIEW' },
    })
    throw err
  }
}

/**
 * Lance le refresh des vues matérialisées (CONCURRENTLY).
 * À appeler périodiquement (ex. toutes les 2h ou après chaque batch d'agrégation, selon charge).
 * Les appels concurrents partagent la même exécution (pas de second `debut` ni refresh DB en double).
 */
export async function refreshAllMaterializedViews(): Promise<void> {
  if (!isDatabaseConfigured()) return
  if (mvRefreshInFlight) return mvRefreshInFlight
  mvRefreshInFlight = (async () => {
    try {
      await runRefreshAllMaterializedViewsOnce()
    } finally {
      mvRefreshInFlight = null
    }
  })()
  return mvRefreshInFlight
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
