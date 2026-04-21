import 'dotenv/config'
import { execFile } from 'node:child_process'
import { writeSync } from 'node:fs'
import { promisify } from 'node:util'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/index.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { RiotHttpClient, resolveRiotApiKey, type RiotLeagueEntryDto } from '../services/RiotHttpClient.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'

const execFileAsync = promisify(execFile)

/** Line-buffered stdout for PM2 / non-TTY (avoids long silent periods). */
function logLine(message: string): void {
  writeSync(1, Buffer.from(`${message}\n`, 'utf8'))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
}

function normalizeRankTier(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim().toUpperCase()
  if (!t || t === 'UNRANKED') return null
  return t.split('_')[0]?.trim() || null
}

function normalizeRankDivision(raw: unknown): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const d = raw.trim().toUpperCase()
  if (!d || d === 'UNRANKED') return null
  return d
}

function normalizeRankLp(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
  return null
}

function isLikelyRiotPuuid(value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  if (!v) return false
  if (/^\d+$/.test(v)) return false
  return v.length >= 30
}

async function main(): Promise<void> {
  const resolved = await resolveRiotApiKey()
  if (!resolved.ok) throw new Error(resolved.error)

  const rateLimiter = new RiotRateLimiter()
  const logger = {
    info: async () => undefined,
    error: async () => undefined,
    step: async () => undefined,
  } as any
  const client = new RiotHttpClient(rateLimiter, logger, 'rank_repair')
  client.setKey(resolved.key, resolved.source, resolved.clefType)

  const maxBatchesPerRun = Math.max(
    1,
    Math.min(100000, parseInt(process.env.RANK_REPAIR_BATCHES_PER_RUN ?? '2000', 10) || 2000)
  )
  const targetGameVersion = (process.env.RANK_REPAIR_GAME_VERSION ?? '').trim()
  const maxRequestsPer120s = Math.max(
    1,
    Math.min(95, parseInt(process.env.RANK_REPAIR_MAX_REQ_120S ?? '95', 10) || 95)
  )
  const windowMs = 120_000
  const maxTouchedMatchesPerWindow = Math.max(
    100,
    Math.min(10000, parseInt(process.env.RANK_REPAIR_MATCH_RECALC_CAP ?? '2000', 10) || 2000)
  )
  let participantsUpdated = 0
  let matchesRecomputed = 0
  let teamsRecomputed = 0
  let batchesProcessed = 0
  let totalCandidates = 0
  let totalApiCalls = 0
  let totalApiSuccess = 0
  let totalApiNoRank = 0
  let totalApiErrors = 0
  let totalWindows = 0
  let lastIngestMatchPlayerId = 0n
  const startedAtMs = Date.now()
  logLine(
    `[rank-repair] start targetGameVersion=${targetGameVersion || 'ALL'} maxReq120s=${maxRequestsPer120s} maxBatches=${maxBatchesPerRun} matchRecalcCap=${maxTouchedMatchesPerWindow}`
  )
  for (let batch = 0; batch < maxBatchesPerRun; batch++) {
    const sqlFetchStart = Date.now()
    logLine(
      `[rank-repair] batch=${batch + 1}/${maxBatchesPerRun} sql_fetch_candidates_start cursorAfter=${lastIngestMatchPlayerId}`
    )
    const candidates = await prisma.$queryRaw<
      Array<{
        cursor_id: bigint
        id: bigint
        puuid: string
        region: string
        rank_tier: string | null
        rank_division: string | null
      }>
    >`
      WITH player_candidates AS (
        SELECT
          imp.player_id,
          MIN(imp.id) AS cursor_id
        FROM ingest_match_players imp
        INNER JOIN ingest_matchs im ON im.id = imp.match_id
        WHERE imp.id > ${lastIngestMatchPlayerId}
          AND COALESCE(NULLIF(TRIM(imp.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
          AND COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
          ${targetGameVersion ? Prisma.sql`AND im.game_version = ${targetGameVersion}` : Prisma.sql``}
        GROUP BY imp.player_id
        ORDER BY MIN(imp.id)
        LIMIT ${maxRequestsPer120s}
      )
      SELECT c.cursor_id, p.id, p.puuid, p.region, p.rank_tier, p.rank_division
      FROM player_candidates c
      INNER JOIN players p ON p.id = c.player_id
      ORDER BY c.cursor_id
    `
    logLine(
      `[rank-repair] batch=${batch + 1} sql_fetch_candidates_done ms=${Date.now() - sqlFetchStart} rows=${candidates.length}`
    )
    if (candidates.length === 0) break
    lastIngestMatchPlayerId = candidates[candidates.length - 1]!.cursor_id
    batchesProcessed++
    totalCandidates += candidates.length

    const eligibleCandidates = candidates.filter((p) => isLikelyRiotPuuid(p.puuid))
    const localRankCandidates = eligibleCandidates.filter((p) => normalizeRankTier(p.rank_tier) != null)
    const apiCandidates = eligibleCandidates.filter((p) => normalizeRankTier(p.rank_tier) == null)
    totalWindows++
    const windowStart = Date.now()
    const windowApiSuccessBefore = totalApiSuccess
    const windowApiNoRankBefore = totalApiNoRank
    const windowApiErrorsBefore = totalApiErrors
    const windowParticipantsUpdatedBefore = participantsUpdated
    const windowMatchesRecomputedBefore = matchesRecomputed
    const windowTeamsRecomputedBefore = teamsRecomputed
    let prefilledFromPlayerRank = 0
    for (const p of localRankCandidates) {
      const playerRankTier = normalizeRankTier(p.rank_tier)
      if (!playerRankTier) continue
      const playerRankDivision = normalizeRankDivision(p.rank_division)
      await prisma.ingestMatchPlayer.updateMany({
        where: {
          playerId: p.id,
          rankTier: 'UNRANKED',
          match: {
            rankTier: 'UNRANKED',
            ...(targetGameVersion ? { gameVersion: targetGameVersion } : {}),
          },
        },
        data: { rankTier: playerRankTier, rankDivision: playerRankDivision },
      })
      prefilledFromPlayerRank++
      participantsUpdated++
    }

    totalApiCalls += apiCandidates.length
    const settled = await Promise.allSettled(
      apiCandidates.map(async (p) => {
        const platform = p.region.toLowerCase()
        const entriesRes = await client.getLeagueEntriesByPuuidOnPlatform(p.puuid, platform, {
          infinite429Retry: true,
        })
        if (!entriesRes.ok) return { ok: false as const, reason: 'api_error' as const, player: p }
        const entries: RiotLeagueEntryDto[] = Array.isArray(entriesRes.data) ? entriesRes.data : []
        const solo =
          entries.find((e) => String(e.queueType ?? '').toUpperCase() === 'RANKED_SOLO_5X5') ??
          entries.find((e) => String(e.queueType ?? '').toUpperCase().includes('RANKED_SOLO')) ??
          entries[0]
        const rankTier = normalizeRankTier(solo?.tier)
        const rankDivision = normalizeRankDivision(solo?.rank)
        const rankLp = normalizeRankLp(solo?.leaguePoints)
        if (!rankTier) return { ok: false as const, reason: 'no_rank' as const, player: p }
        return { ok: true as const, player: p, rankTier, rankDivision, rankLp }
      })
    )

    const successfulPlayerIds: bigint[] = []
    for (const s of settled) {
      if (s.status === 'rejected') {
        totalApiErrors++
        continue
      }
      if (!s.value.ok) {
        if (s.value.reason === 'no_rank') {
          totalApiNoRank++
          // Explicitly mark unresolved ladder rows as UNRANKED so they are accounted
          // for in match/team recomputation instead of silently staying null/empty.
          await prisma.ingestMatchPlayer.updateMany({
            where: {
              playerId: s.value.player.id,
              match: {
                rankTier: 'UNRANKED',
                ...(targetGameVersion ? { gameVersion: targetGameVersion } : {}),
              },
            },
            data: { rankTier: 'UNRANKED', rankDivision: null },
          })
        } else totalApiErrors++
        continue
      }
      totalApiSuccess++
      successfulPlayerIds.push(s.value.player.id)
      await prisma.ingestMatchPlayer.updateMany({
        where: {
          playerId: s.value.player.id,
          rankTier: 'UNRANKED',
          match: {
            rankTier: 'UNRANKED',
            ...(targetGameVersion ? { gameVersion: targetGameVersion } : {}),
          },
        },
        data: { rankTier: s.value.rankTier, rankDivision: s.value.rankDivision },
      })
      await prisma.player.update({
        where: { id: s.value.player.id },
        data: {
          rankTier: s.value.rankTier,
          rankDivision: s.value.rankDivision,
          rankLp: s.value.rankLp,
          rankSnapshotGameDate: new Date(),
        },
      })
      participantsUpdated++
    }

    const touchedRows =
      successfulPlayerIds.length > 0
        ? await prisma.$queryRaw<Array<{ match_id: bigint }>>`
            SELECT DISTINCT imp.match_id
            FROM ingest_match_players imp
            INNER JOIN ingest_matchs im ON im.id = imp.match_id
            WHERE imp.player_id IN (${Prisma.join(successfulPlayerIds)})
              AND COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
              ${targetGameVersion ? Prisma.sql`AND im.game_version = ${targetGameVersion}` : Prisma.sql``}
            LIMIT ${maxTouchedMatchesPerWindow}
          `
        : []
    const touchedMatchIds = touchedRows.map((r) => r.match_id)
    if (touchedMatchIds.length > 0) {
      const rows = await prisma.ingestMatchPlayer.findMany({
        where: { matchId: { in: touchedMatchIds } },
        select: { matchId: true, rankTier: true, rankDivision: true, teamId: true },
      })
      const byMatch = new Map<string, typeof rows>()
      for (const row of rows) {
        const key = row.matchId.toString()
        const arr = byMatch.get(key) ?? []
        arr.push(row)
        byMatch.set(key, arr)
      }
      for (const matchId of touchedMatchIds) {
        const participants = byMatch.get(matchId.toString()) ?? []
        if (participants.length < 10) continue
        const scores: number[] = []
        const teamScores = new Map<string, number[]>()
        for (const part of participants) {
          const normalizedTier =
            part.rankTier && part.rankTier.trim() !== '' ? part.rankTier.trim().toUpperCase() : 'UNRANKED'
          const score = rankToScore(normalizedTier, part.rankDivision ?? null, null)
          scores.push(score)
          const tk = part.teamId.toString()
          const arr = teamScores.get(tk) ?? []
          arr.push(score)
          teamScores.set(tk, arr)
        }
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length
          const r = scoreToRank(avg)
          await prisma.ingestMatch.update({
            where: { id: matchId },
            data: { rankTier: r.tier, rankDivision: r.division },
          })
          matchesRecomputed++
        }
        for (const [teamId, ts] of teamScores.entries()) {
          if (ts.length < 5) continue
          const avg = ts.reduce((a, b) => a + b, 0) / ts.length
          const r = scoreToRank(avg)
          await prisma.ingestTeam.update({
            where: { id: BigInt(teamId) },
            data: { rankTier: r.tier },
          })
          teamsRecomputed++
        }
      }
    }

    const elapsed = Date.now() - windowStart
    const waitMs = Math.max(0, windowMs - elapsed)
    const windowApiSuccessDelta = totalApiSuccess - windowApiSuccessBefore
    const windowApiNoRankDelta = totalApiNoRank - windowApiNoRankBefore
    const windowApiErrorsDelta = totalApiErrors - windowApiErrorsBefore
    const windowParticipantsUpdatedDelta = participantsUpdated - windowParticipantsUpdatedBefore
    const windowMatchesRecomputedDelta = matchesRecomputed - windowMatchesRecomputedBefore
    const windowTeamsRecomputedDelta = teamsRecomputed - windowTeamsRecomputedBefore
    const totalElapsedMs = Date.now() - startedAtMs
    logLine(
      `[rank-repair] window=${totalWindows} batch=${batchesProcessed}/${maxBatchesPerRun} candidates=${candidates.length} eligible=${eligibleCandidates.length} localPrefill=${prefilledFromPlayerRank} apiCandidates=${apiCandidates.length} apiSuccess=${windowApiSuccessDelta} apiNoRank=${windowApiNoRankDelta} apiError=${windowApiErrorsDelta} participantsUpdated=${windowParticipantsUpdatedDelta} touchedMatches=${touchedMatchIds.length} matchesRecomputed=${windowMatchesRecomputedDelta} teamsRecomputed=${windowTeamsRecomputedDelta} elapsedMs=${elapsed} waitMs=${waitMs} totalElapsedSec=${Math.round(totalElapsedMs / 1000)}`
    )
    if (waitMs > 0) await sleep(waitMs)
  }

  logLine(`[rank-repair] targetGameVersion: ${targetGameVersion || 'ALL'}`)
  logLine(`[rank-repair] batchesProcessed: ${batchesProcessed}`)
  logLine(`[rank-repair] candidates: ${totalCandidates}`)
  logLine(`[rank-repair] maxRequestsPer120s: ${maxRequestsPer120s}`)
  logLine(`[rank-repair] windowsProcessed: ${totalWindows}`)
  logLine(`[rank-repair] apiCalls: ${totalApiCalls}`)
  logLine(`[rank-repair] apiSuccessWithRank: ${totalApiSuccess}`)
  logLine(`[rank-repair] apiNoRank: ${totalApiNoRank}`)
  logLine(`[rank-repair] apiErrors: ${totalApiErrors}`)
  logLine(`[rank-repair] maxBatchesPerRun: ${maxBatchesPerRun}`)
  logLine(`[rank-repair] participantsUpdated: ${participantsUpdated}`)
  logLine(`[rank-repair] matchesRecomputed: ${matchesRecomputed}`)
  logLine(`[rank-repair] teamsRecomputed: ${teamsRecomputed}`)

  const skipPollerRestart = ['1', 'true', 'yes', 'on'].includes(
    (process.env.RANK_REPAIR_SKIP_POLLER_RESTART ?? '').trim().toLowerCase()
  )
  if (skipPollerRestart) {
    logLine('[rank-repair] poller_restart: skipped (RANK_REPAIR_SKIP_POLLER_RESTART)')
    return
  }
  try {
    const { stdout, stderr } = await execFileAsync('pm2', ['restart', 'lelanation-poller'])
    if (stdout?.trim()) logLine(`[rank-repair] poller_restart_stdout: ${stdout.trim()}`)
    if (stderr?.trim()) logLine(`[rank-repair] poller_restart_stderr: ${stderr.trim()}`)
    logLine('[rank-repair] poller_restart: done')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[rank-repair] poller_restart: failed', message)
  }
}

void main()
  .catch((err) => {
    console.error('[rank-repair] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
