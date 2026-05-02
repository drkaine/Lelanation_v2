import { isDatabaseConfigured, prisma } from '../db.js'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
  deletedRawRows: number
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BACKEND_ROOT = path.resolve(__dirname, '..', '..')
const BACKFILL_LOCK_FILE = path.join(BACKEND_ROOT, 'data', 'locks', 'backfill-agg.lock')

async function isBackfillRunning(): Promise<boolean> {
  try {
    await access(BACKFILL_LOCK_FILE)
    return true
  } catch {
    return false
  }
}

async function ensureArchiveUpdatedAtColumn(archiveTable: string): Promise<void> {
  const safeArchive = ensureSafeTableName(archiveTable)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE ${safeArchive}
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL
  `)
}

async function countRowsByPatch(table: string, patchSql: string): Promise<number> {
  const safe = ensureSafeTableName(table)
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint | number }>>(`
    SELECT COUNT(*) AS c
    FROM ${safe}
    WHERE game_version IN (${patchSql})
  `)
  const raw = rows[0]?.c ?? 0
  return typeof raw === 'bigint' ? Number(raw) : Number(raw)
}

async function deleteAggregatedRawRows(): Promise<number> {
  const retentionMs = Math.max(
    0,
    Math.min(
      30 * 24 * 60 * 60 * 1000,
      Number(process.env.LIVE_AGG_ARCHIVE_DONE_RETENTION_MS ?? 36 * 60 * 60 * 1000)
    )
  )
  const retentionSec = Math.ceil(retentionMs / 1000)
  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM match_ingest_raw
    WHERE status = 'done'
      AND normalized_at IS NOT NULL
      AND normalized_at <= NOW() - (${retentionSec} * INTERVAL '1 second')
  `)
  return Number(deleted ?? 0)
}

export async function runLiveAggArchiveCheckpointOnce(): Promise<LiveAggArchiveCheckpointResult> {
  if (!isDatabaseConfigured()) {
    return { ok: true, livePatches: [], copiedTables: [], deletedRawRows: 0 }
  }
  if (await isBackfillRunning()) {
    return { ok: true, livePatches: [], copiedTables: [], deletedRawRows: 0 }
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
    return { ok: true, livePatches: [], copiedTables: [], deletedRawRows: 0 }
  }

  const copiedTables: string[] = []
  let deletedRawRows = 0
  const livePatchSql = livePatches.map((v) => `'${v.replace(/'/g, "''")}'`).join(',')

  const versionedPresent: (typeof VERSIONED_TABLES)[number][] = []
  for (const table of VERSIONED_TABLES) {
    const archiveTable = `archive_${table}`
    if (await tableExists(archiveTable)) {
      await ensureArchiveUpdatedAtColumn(archiveTable)
      versionedPresent.push(table)
    }
  }
  const championSatPresent: (typeof CHAMPION_SATELLITE_TABLES)[number][] = []
  for (const table of CHAMPION_SATELLITE_TABLES) {
    const archiveTable = `archive_${table}`
    if (await tableExists(archiveTable)) {
      await ensureArchiveUpdatedAtColumn(archiveTable)
      championSatPresent.push(table)
    }
  }
  const teamSatPresent: (typeof TEAM_SATELLITE_TABLES)[number][] = []
  for (const table of TEAM_SATELLITE_TABLES) {
    const archiveTable = `archive_${table}`
    if (await tableExists(archiveTable)) {
      await ensureArchiveUpdatedAtColumn(archiveTable)
      teamSatPresent.push(table)
    }
  }

  const txTimeoutMs = Math.max(
    60_000,
    Math.min(
      3_600_000,
      Number(process.env.LIVE_AGG_ARCHIVE_CHECKPOINT_TX_TIMEOUT_MS ?? 1_800_000)
    )
  )

  await prisma.$transaction(
    async (tx) => {
      for (const table of versionedPresent) {
        const archiveTable = `archive_${table}`
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
        await tx.$executeRawUnsafe(`
        UPDATE ${safeArchive}
        SET updated_at = NOW()
        WHERE game_version IN (${livePatchSql})
      `)
        copiedTables.push(table)
      }

      for (const table of championSatPresent) {
        const archiveTable = `archive_${table}`
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
        await tx.$executeRawUnsafe(`
        UPDATE ${safeArchive} s
        SET updated_at = NOW()
        FROM archive_agg_champion_core_stats c
        WHERE c.id = s.champion_stat_id
          AND c.game_version IN (${livePatchSql})
      `)
        copiedTables.push(table)
      }

      for (const table of teamSatPresent) {
        const archiveTable = `archive_${table}`
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
        await tx.$executeRawUnsafe(`
        UPDATE ${safeArchive} s
        SET updated_at = NOW()
        FROM archive_agg_team_core_stats t
        WHERE t.id = s.team_stat_id
          AND t.game_version IN (${livePatchSql})
      `)
        copiedTables.push(table)
      }
    },
    { maxWait: 60_000, timeout: txTimeoutMs }
  )

  const coreSrcCount = await countRowsByPatch('agg_champion_core_stats', livePatchSql)
  const coreArchiveExists = await tableExists('archive_agg_champion_core_stats')
  const coreArchiveCount = coreArchiveExists
    ? await countRowsByPatch('archive_agg_champion_core_stats', livePatchSql)
    : 0
  if (coreSrcCount > 0 && coreArchiveCount <= 0) {
    throw new Error(
      '[liveAggArchiveCheckpoint] snapshot verification failed: archive_agg_champion_core_stats has no rows for live patches'
    )
  }
  if (coreArchiveCount < coreSrcCount) {
    throw new Error(
      `[liveAggArchiveCheckpoint] snapshot verification failed: archive core rows (${coreArchiveCount}) < source core rows (${coreSrcCount})`
    )
  }

  deletedRawRows = await deleteAggregatedRawRows()
  return { ok: true, livePatches, copiedTables, deletedRawRows }
}
