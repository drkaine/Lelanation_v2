import { isDatabaseConfigured, prisma } from '../db.js'

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
] as const

const TEAM_SATELLITE_TABLES = ['agg_team_bucket'] as const

function ensureSafeTableName(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`unsafe_table_name:${name}`)
  }
  return name
}

async function tableExists(name: string): Promise<boolean> {
  const safe = ensureSafeTableName(name)
  const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT to_regclass('public.${safe}') IS NOT NULL AS ok`
  )
  return Boolean(rows[0]?.ok)
}

export type LiveAggArchiveCheckpointResult = {
  ok: boolean
  livePatches: string[]
  copiedTables: string[]
}

export async function runLiveAggArchiveCheckpointOnce(): Promise<LiveAggArchiveCheckpointResult> {
  if (!isDatabaseConfigured()) {
    return { ok: true, livePatches: [], copiedTables: [] }
  }

  const livePatchesRows = await prisma.activePatch.findMany({
    where: { archivedAt: null },
    select: { gameVersion: true },
    orderBy: { gameVersion: 'asc' },
  })
  const livePatches = livePatchesRows
    .map((r) => String(r.gameVersion ?? '').trim())
    .filter((v) => v.length > 0)
  if (livePatches.length === 0) {
    return { ok: true, livePatches: [], copiedTables: [] }
  }

  const copiedTables: string[] = []
  const livePatchSql = livePatches.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')

  await prisma.$transaction(async (tx) => {
    for (const table of VERSIONED_TABLES) {
      const archiveTable = `archive_${table}`
      if (!(await tableExists(archiveTable))) continue
      const safeTable = ensureSafeTableName(table)
      const safeArchive = ensureSafeTableName(archiveTable)
      await tx.$executeRawUnsafe(`
        DELETE FROM ${safeArchive}
        WHERE game_version IN (${livePatchSql})
      `)
      await tx.$executeRawUnsafe(`
        INSERT INTO ${safeArchive}
        SELECT *
        FROM ${safeTable}
        WHERE game_version IN (${livePatchSql})
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
          AND c.game_version IN (${livePatchSql})
      `)
      await tx.$executeRawUnsafe(`
        INSERT INTO ${safeArchive}
        SELECT s.*
        FROM ${safeTable} s
        INNER JOIN agg_champion_core_stats c ON c.id = s.champion_stat_id
        WHERE c.game_version IN (${livePatchSql})
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
          AND t.game_version IN (${livePatchSql})
      `)
      await tx.$executeRawUnsafe(`
        INSERT INTO ${safeArchive}
        SELECT s.*
        FROM ${safeTable} s
        INNER JOIN agg_team_core_stats t ON t.id = s.team_stat_id
        WHERE t.game_version IN (${livePatchSql})
      `)
      copiedTables.push(table)
    }
  })

  return { ok: true, livePatches, copiedTables }
}
