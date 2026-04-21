import 'dotenv/config'
import { execFile, spawn } from 'node:child_process'
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
  const startedAtMs = Date.now()
  const mergedEnv = { ...process.env, ...env }
  const child = spawn('node', ['--import', 'tsx', scriptPath], {
    env: mergedEnv,
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  child.stdout?.on('data', (chunk: string) => {
    stdout += chunk
    process.stdout.write(chunk)
  })
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk
    process.stderr.write(chunk)
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => resolve(code ?? 1))
  })

  const elapsedMs = Date.now() - startedAtMs
  console.log(`[global-rank-recovery] script_done path=${scriptPath} elapsedMs=${elapsedMs}`)
  if (exitCode !== 0) {
    throw new Error(
      `[global-rank-recovery] script_failed path=${scriptPath} exitCode=${exitCode} stderr=${stderr.trim()}`
    )
  }
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
  const globalStartedAtMs = Date.now()
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
      const roundStartedAtMs = Date.now()
      console.log(
        `[global-rank-recovery] round ${round}/${maxRounds} start: unranked=${previousUnranked}`
      )
      await runTsxScript('src/scripts/repairMissingRanks.ts', {
        RANK_REPAIR_SKIP_POLLER_RESTART: '1',
        RANK_REPAIR_MAX_REQ_120S: String(maxReq120s),
        RANK_REPAIR_BATCH_SIZE: String(perRunBatchSize),
        RANK_REPAIR_BATCHES_PER_RUN: String(perRunBatches),
        RANK_REPAIR_GAME_VERSION: targetGameVersion,
      })
      const afterRound = await countUnrankedMatches(targetGameVersion)
      const elapsedMs = Date.now() - roundStartedAtMs
      const delta = previousUnranked - afterRound
      console.log(
        `[global-rank-recovery] round ${round} done: unranked=${afterRound} delta=${delta} elapsedMs=${elapsedMs}`
      )
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
    console.log(
      `[global-rank-recovery] completed totalElapsedSec=${Math.round((Date.now() - globalStartedAtMs) / 1000)}`
    )
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
