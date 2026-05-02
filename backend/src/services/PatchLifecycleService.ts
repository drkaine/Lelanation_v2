import { prisma, isDatabaseConfigured } from '../db.js'
import { invalidateAggArchivePartitionCache } from './statsAggArchive.js'

const VERSIONED_TABLES = [
  'agg_match_outcome_stats',
  'agg_champion_core_stats',
  'agg_team_core_stats',
  'agg_champion_vs_stats',
  'agg_champion_side_stats',
  'agg_botlane_duo_vs_duo_stats',
  'agg_champion_summoner_spell_pair_stats',
  'agg_champion_item_starter_set_stats',
  'agg_objective_outcome_stats',
] as const

const CHAMPION_SATELLITE_TABLES = [
  'agg_champion_bucket',
  'agg_champion_damage_stats',
  'agg_champion_duo_role_stats',
  'agg_champion_participant_stats',
  'agg_champion_spells_stats',
  'agg_champion_summoner_spells',
  'agg_champion_runes_stats',
  'agg_champion_runes_solo_stats',
  'agg_champion_shard_solo_stats',
  'agg_champion_item_stats',
  'agg_champion_item_solo_stats',
  'agg_champion_bans_by_banner',
] as const

const TEAM_SATELLITE_TABLES = ['agg_team_bucket'] as const

function ensureSafeTableName(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`unsafe_table_name:${name}`)
  return name
}

function normalizePatchKey(value: string): string {
  const parts = String(value ?? '')
    .trim()
    .split('.')
    .filter(Boolean)
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return String(value ?? '').trim()
}

async function tableExists(name: string): Promise<boolean> {
  const safe = ensureSafeTableName(name)
  const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT to_regclass('public.${safe}') IS NOT NULL AS ok`
  )
  return Boolean(rows[0]?.ok)
}

async function closePatchWithoutLegacyFunction(patch: string): Promise<unknown> {
  const patchKey = normalizePatchKey(patch)
  if (!patchKey) return null
  const patchSql = `'${patchKey.replace(/'/g, "''")}'`
  const copiedTables: string[] = []

  await prisma.$transaction(async (tx) => {
    for (const table of VERSIONED_TABLES) {
      const archiveTable = `archive_${table}`
      if (!(await tableExists(archiveTable))) continue
      const safeTable = ensureSafeTableName(table)
      const safeArchive = ensureSafeTableName(archiveTable)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeArchive}
        WHERE game_version = ${patchSql}
           OR game_version LIKE ${patchSql} || '.%'
      `)
      await tx.$executeRawUnsafe(`
        INSERT INTO ${safeArchive}
        SELECT *
        FROM ${safeTable}
        WHERE game_version = ${patchSql}
           OR game_version LIKE ${patchSql} || '.%'
      `)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeTable}
        WHERE game_version = ${patchSql}
           OR game_version LIKE ${patchSql} || '.%'
      `)
      copiedTables.push(table)
    }

    for (const table of CHAMPION_SATELLITE_TABLES) {
      const archiveTable = `archive_${table}`
      if (!(await tableExists(archiveTable))) continue
      const safeTable = ensureSafeTableName(table)
      const safeArchive = ensureSafeTableName(archiveTable)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeArchive} s
        USING archive_agg_champion_core_stats c
        WHERE c.id = s.champion_stat_id
          AND (c.game_version = ${patchSql} OR c.game_version LIKE ${patchSql} || '.%')
      `)
      await tx.$executeRawUnsafe(`
        INSERT INTO ${safeArchive}
        SELECT s.*
        FROM ${safeTable} s
        INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
        WHERE c.game_version = ${patchSql}
           OR c.game_version LIKE ${patchSql} || '.%'
      `)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeTable} s
        USING agg_champion_core_stats c
        WHERE c.id = s.champion_stat_id
          AND (c.game_version = ${patchSql} OR c.game_version LIKE ${patchSql} || '.%')
      `)
      copiedTables.push(table)
    }

    for (const table of TEAM_SATELLITE_TABLES) {
      const archiveTable = `archive_${table}`
      if (!(await tableExists(archiveTable))) continue
      const safeTable = ensureSafeTableName(table)
      const safeArchive = ensureSafeTableName(archiveTable)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeArchive} s
        USING archive_agg_team_core_stats t
        WHERE t.id = s.team_stat_id
          AND (t.game_version = ${patchSql} OR t.game_version LIKE ${patchSql} || '.%')
      `)
      await tx.$executeRawUnsafe(`
        INSERT INTO ${safeArchive}
        SELECT s.*
        FROM ${safeTable} s
        INNER JOIN agg_team_core_stats t ON t.id = s.team_stat_id
        WHERE t.game_version = ${patchSql}
           OR t.game_version LIKE ${patchSql} || '.%'
      `)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeTable} s
        USING agg_team_core_stats t
        WHERE t.id = s.team_stat_id
          AND (t.game_version = ${patchSql} OR t.game_version LIKE ${patchSql} || '.%')
      `)
      copiedTables.push(table)
    }

    await tx.$executeRawUnsafe(`
      UPDATE active_patches
      SET archived_at = NOW(),
          is_current = false
      WHERE game_version = ${patchSql}
    `)
  })

  return { ok: true, mode: 'ts-fallback', patch: patchKey, copiedTables }
}

/**
 * Close a patch using DB-side lifecycle function.
 * Keeps patch archival/deletion concerns isolated from MV runtime services.
 */
/** JSON from SQL close_patch(): games, row counts, etc. */
export async function closePatch(patch: string): Promise<unknown> {
  if (!isDatabaseConfigured()) return null
  const value = (patch ?? '').trim()
  if (!value) return null
  let summary: unknown = null
  try {
    const rows = await prisma.$queryRaw<[{ close_patch: unknown }]>`
      SELECT close_patch(${value}::text) AS close_patch
    `
    summary = rows[0]?.close_patch ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('relation "ingest_matchs" does not exist')) throw err
    summary = await closePatchWithoutLegacyFunction(value)
  }
  invalidateAggArchivePartitionCache()
  return summary
}
