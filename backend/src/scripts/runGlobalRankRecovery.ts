import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '../db.js'

const execFileAsync = promisify(execFile)

type CountRow = { c: bigint | number }

function toBool(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

async function countUnrankedMatches(targetGameVersion: string): Promise<number> {
  const rows = targetGameVersion
    ? await prisma.$queryRaw<Array<CountRow>>`
        SELECT COUNT(*)::bigint AS c
        FROM ingest_matchs im
        WHERE im.game_version = ${targetGameVersion}
          AND COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
      `
    : await prisma.$queryRaw<Array<CountRow>>`
        SELECT COUNT(*)::bigint AS c
        FROM ingest_matchs im
        WHERE COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
      `
  return Number(rows[0]?.c ?? 0)
}

async function runTsxScript(scriptPath: string, env: NodeJS.ProcessEnv): Promise<void> {
  await execFileAsync('node', ['--import', 'tsx', scriptPath], {
    env: { ...process.env, ...env },
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 20,
  })
}

async function stopPoller(): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync('pm2', ['stop', 'lelanation-poller'])
    if (stdout?.trim()) console.log('[global-rank-recovery] poller_stop_stdout:', stdout.trim())
    if (stderr?.trim()) console.log('[global-rank-recovery] poller_stop_stderr:', stderr.trim())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[global-rank-recovery] poller_stop_failed:', message)
  }
}

async function startPoller(): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync('pm2', ['start', 'lelanation-poller'])
    if (stdout?.trim()) console.log('[global-rank-recovery] poller_start_stdout:', stdout.trim())
    if (stderr?.trim()) console.log('[global-rank-recovery] poller_start_stderr:', stderr.trim())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[global-rank-recovery] poller_start_failed:', message)
  }
}

async function main(): Promise<void> {
  const targetGameVersion = (process.env.RANK_REPAIR_GAME_VERSION ?? '').trim()
  const maxReq120s = Math.max(1, Math.min(95, Number(process.env.RANK_REPAIR_MAX_REQ_120S ?? 95) || 95))
  const perRunBatchSize = Math.max(100, Math.min(5000, Number(process.env.RANK_REPAIR_BATCH_SIZE ?? 1000) || 1000))
  const perRunBatches = Math.max(1, Math.min(2000, Number(process.env.RANK_REPAIR_BATCHES_PER_RUN ?? 200) || 200))
  const maxRounds = Math.max(1, Math.min(200, Number(process.env.RANK_REPAIR_MAX_ROUNDS ?? 50) || 50))
  const runBackfillAgg = toBool(process.env.GLOBAL_RANK_RECOVERY_RUN_BACKFILL_AGG, true)

  console.log('[global-rank-recovery] targetGameVersion:', targetGameVersion || 'ALL')
  console.log('[global-rank-recovery] maxReq120s:', maxReq120s)
  console.log('[global-rank-recovery] perRunBatchSize:', perRunBatchSize)
  console.log('[global-rank-recovery] perRunBatches:', perRunBatches)
  console.log('[global-rank-recovery] maxRounds:', maxRounds)
  console.log('[global-rank-recovery] runBackfillAgg:', runBackfillAgg)

  await stopPoller()
  try {
    let previousUnranked = await countUnrankedMatches(targetGameVersion)
    console.log('[global-rank-recovery] unranked_matches_before:', previousUnranked)

    for (let round = 1; round <= maxRounds; round++) {
      if (previousUnranked <= 0) break
      console.log(`[global-rank-recovery] round ${round}/${maxRounds} start: unranked=${previousUnranked}`)
      await runTsxScript('src/scripts/repairMissingRanks.ts', {
        RANK_REPAIR_SKIP_POLLER_RESTART: '1',
        RANK_REPAIR_MAX_REQ_120S: String(maxReq120s),
        RANK_REPAIR_BATCH_SIZE: String(perRunBatchSize),
        RANK_REPAIR_BATCHES_PER_RUN: String(perRunBatches),
        RANK_REPAIR_GAME_VERSION: targetGameVersion,
      })
      const afterRound = await countUnrankedMatches(targetGameVersion)
      console.log(`[global-rank-recovery] round ${round} done: unranked=${afterRound}`)
      if (afterRound >= previousUnranked) {
        console.log('[global-rank-recovery] no_progress_detected: stopping catch-up loop')
        break
      }
      previousUnranked = afterRound
    }

    console.log('[global-rank-recovery] recompute_ingest_ranks: start')
    await runTsxScript('src/scripts/recomputeIngestRanks.ts', {})
    console.log('[global-rank-recovery] recompute_ingest_ranks: done')

    console.log('[global-rank-recovery] repair_players_metadata: start')
    await runTsxScript('src/scripts/repairPlayersMetadata.ts', {})
    console.log('[global-rank-recovery] repair_players_metadata: done')

    if (runBackfillAgg) {
      console.log('[global-rank-recovery] backfill_agg: start')
      await runTsxScript('src/scripts/backfillAggFromIngest.ts', {})
      console.log('[global-rank-recovery] backfill_agg: done')
    }
  } finally {
    await startPoller()
  }
}

void main()
  .catch((err) => {
    console.error('[global-rank-recovery] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
