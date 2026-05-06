import 'dotenv/config'
import { prisma } from '../db.js'
import { loadCurrentGameVersion, releaseDateToStartOfDayUtcSeconds } from '../services/RiotConfigService.js'

function isApplyMode(): boolean {
  const raw = (process.env.APPLY ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function getMaxAgeHours(): number {
  const raw = Number.parseInt(process.env.STALE_MAX_AGE_HOURS ?? '24', 10)
  if (!Number.isFinite(raw) || raw <= 0) return 24
  return Math.min(raw, 24 * 30)
}

async function tableExists(tableName: string): Promise<boolean> {
  if (!/^[a-z0-9_]+$/i.test(tableName)) return false
  const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT to_regclass('public.${tableName}') IS NOT NULL AS ok`
  )
  return Boolean(rows[0]?.ok)
}

async function main(): Promise<void> {
  const currentRes = await loadCurrentGameVersion()
  if (currentRes.isErr()) {
    throw new Error(`Unable to read version.json: ${currentRes.unwrapErr().message}`)
  }
  const current = currentRes.unwrap()
  const releaseDate = current?.releaseDate ?? null
  if (!releaseDate) {
    throw new Error('version.json releaseDate is missing')
  }
  const releaseStart = releaseDateToStartOfDayUtcSeconds(releaseDate)
  if (!Number.isFinite(releaseStart)) {
    throw new Error(`Invalid releaseDate format: ${releaseDate}`)
  }
  const cutoffSec = releaseStart + 86400
  const cutoffDate = new Date(cutoffSec * 1000)
  const maxAgeHours = getMaxAgeHours()
  const ageCutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
  const hasIngestMatchs = await tableExists('ingest_matchs')
  const hasMatchIngestRaw = await tableExists('match_ingest_raw')

  const conditions = [
    `tm.status = 'PENDING'`,
    `tm.aggregate_status = 'PENDING'`,
    `tm.created_at < $1`,
    `tm.created_at < $2`,
    `(
      tm.player1 IS NULL AND tm.player2 IS NULL AND tm.player3 IS NULL AND tm.player4 IS NULL AND tm.player5 IS NULL
      AND tm.player6 IS NULL AND tm.player7 IS NULL AND tm.player8 IS NULL AND tm.player9 IS NULL AND tm.player10 IS NULL
    )`,
  ]
  if (hasIngestMatchs) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM ingest_matchs im WHERE im.riot_match_id = tm.match_id)`
    )
  }
  if (hasMatchIngestRaw) {
    conditions.push(
      `NOT EXISTS (SELECT 1 FROM match_ingest_raw mr WHERE mr.riot_match_id = tm.match_id AND mr.status IN ('pending','processing'))`
    )
  }
  const whereSql = conditions.join('\n      AND ')
  const candidateRows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c
     FROM tracked_matches tm
     WHERE ${whereSql}`,
    cutoffDate,
    ageCutoffDate
  )
  const candidates = Number(candidateRows[0]?.c ?? 0)
  console.log(
    `[reclassify-stale-tracked] releaseDate=${releaseDate} cutoffIso=${cutoffDate.toISOString()} ageCutoffIso=${ageCutoffDate.toISOString()} maxAgeHours=${maxAgeHours} candidates=${candidates} hasIngestMatchs=${hasIngestMatchs ? 1 : 0} hasMatchIngestRaw=${hasMatchIngestRaw ? 1 : 0}`
  )
  if (!isApplyMode()) {
    console.log('[reclassify-stale-tracked] dry-run only (set APPLY=1 to execute update)')
    return
  }

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE tracked_matches tm
     SET status = 'DEFERRED_PATCH'
     WHERE ${whereSql}`,
    cutoffDate,
    ageCutoffDate
  )
  console.log(`[reclassify-stale-tracked] updated=${updated}`)
}

void main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
