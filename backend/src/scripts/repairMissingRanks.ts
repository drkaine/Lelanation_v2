import 'dotenv/config'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/index.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { RiotHttpClient, resolveRiotApiKey, type RiotLeagueEntryDto } from '../services/RiotHttpClient.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'

const execFileAsync = promisify(execFile)

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

  const batchSize = Math.max(
    50,
    Math.min(5000, parseInt(process.env.RANK_REPAIR_BATCH_SIZE ?? '1000', 10) || 1000)
  )
  const maxBatchesPerRun = Math.max(
    1,
    Math.min(1000, parseInt(process.env.RANK_REPAIR_BATCHES_PER_RUN ?? '10', 10) || 10)
  )
  const targetGameVersion = (process.env.RANK_REPAIR_GAME_VERSION ?? '').trim()
  const maxRequestsPer120s = Math.max(
    1,
    Math.min(95, parseInt(process.env.RANK_REPAIR_MAX_REQ_120S ?? '95', 10) || 95)
  )
  const windowMs = 120_000
  const minIntervalMs = Math.ceil(windowMs / maxRequestsPer120s)
  let participantsUpdated = 0
  let matchesRecomputed = 0
  let teamsRecomputed = 0
  let batchesProcessed = 0
  let totalTargetMatches = 0
  let totalCandidates = 0
  let lastMatchId = 0n
  let windowStartedAt = Date.now()
  let requestsInWindow = 0
  let nextAllowedAt = Date.now()
  for (let batch = 0; batch < maxBatchesPerRun; batch++) {
    const unrankedMatches = targetGameVersion
      ? await prisma.$queryRaw<Array<{ id: bigint }>>`
          SELECT im.id
          FROM ingest_matchs im
          WHERE im.id > ${lastMatchId}
            AND im.game_version = ${targetGameVersion}
            AND COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
          ORDER BY im.id
          LIMIT ${batchSize}
        `
      : await prisma.$queryRaw<Array<{ id: bigint }>>`
          SELECT im.id
          FROM ingest_matchs im
          WHERE im.id > ${lastMatchId}
            AND COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
          ORDER BY im.id
          LIMIT ${batchSize}
        `
    const targetMatchIds = unrankedMatches.map((m) => m.id)
    if (targetMatchIds.length === 0) break
    lastMatchId = targetMatchIds[targetMatchIds.length - 1] ?? lastMatchId
    batchesProcessed++
    totalTargetMatches += targetMatchIds.length

    const candidates = await prisma.$queryRaw<
      Array<{ id: bigint; puuid: string; region: string }>
    >`
      SELECT DISTINCT p.id, p.puuid, p.region
      FROM ingest_match_players imp
      INNER JOIN players p ON p.id = imp.player_id
      WHERE imp.match_id IN (${Prisma.join(targetMatchIds)})
      ORDER BY p.id
    `
    totalCandidates += candidates.length

    for (const p of candidates) {
      if (!isLikelyRiotPuuid(p.puuid)) continue
      const now = Date.now()
      if (now < nextAllowedAt) {
        await sleep(nextAllowedAt - now)
      }
      if (requestsInWindow >= maxRequestsPer120s) {
        const elapsed = Date.now() - windowStartedAt
        const waitMs = Math.max(0, windowMs - elapsed)
        if (waitMs > 0) {
          console.log('[rank-repair] window_limit_reached: sleeping_ms=', waitMs)
          await sleep(waitMs)
        }
        windowStartedAt = Date.now()
        requestsInWindow = 0
      }
      const platform = p.region.toLowerCase()
      requestsInWindow++
      nextAllowedAt = Date.now() + minIntervalMs
      const entriesRes = await client.getLeagueEntriesByPuuidOnPlatform(p.puuid, platform, {
        infinite429Retry: true,
      })
      if (!entriesRes.ok) continue
      const entries: RiotLeagueEntryDto[] = Array.isArray(entriesRes.data) ? entriesRes.data : []
      const solo =
        entries.find((e) => String(e.queueType ?? '').toUpperCase() === 'RANKED_SOLO_5X5') ??
        entries.find((e) => String(e.queueType ?? '').toUpperCase().includes('RANKED_SOLO')) ??
        entries[0]
      const rankTier = normalizeRankTier(solo?.tier)
      const rankDivision = normalizeRankDivision(solo?.rank)
      const rankLp = normalizeRankLp(solo?.leaguePoints)
      if (!rankTier) continue

      await prisma.ingestMatchPlayer.updateMany({
        where: {
          playerId: p.id,
          matchId: { in: targetMatchIds },
          rankTier: 'UNRANKED',
        },
        data: { rankTier, rankDivision },
      })
      await prisma.player.update({
        where: { id: p.id },
        data: {
          rankTier,
          rankDivision,
          rankLp,
          rankSnapshotGameDate: new Date(),
        },
      })
      participantsUpdated++
    }

    const rows = await prisma.ingestMatchPlayer.findMany({
      where: { matchId: { in: targetMatchIds } },
      select: { matchId: true, rankTier: true, rankDivision: true, teamId: true },
    })
    const byMatch = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = row.matchId.toString()
      const arr = byMatch.get(key) ?? []
      arr.push(row)
      byMatch.set(key, arr)
    }
    for (const matchId of targetMatchIds) {
      const participants = byMatch.get(matchId.toString()) ?? []
      const scores: number[] = []
      const teamScores = new Map<string, number[]>()
      for (const part of participants) {
        if (!part.rankTier || part.rankTier === 'UNRANKED') continue
        const score = rankToScore(part.rankTier, part.rankDivision ?? null, null)
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
        if (ts.length === 0) continue
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

  console.log('[rank-repair] targetGameVersion:', targetGameVersion || 'ALL')
  console.log('[rank-repair] batchesProcessed:', batchesProcessed)
  console.log('[rank-repair] targetUnrankedMatches:', totalTargetMatches)
  console.log('[rank-repair] candidates:', totalCandidates)
  console.log('[rank-repair] maxRequestsPer120s:', maxRequestsPer120s)
  console.log('[rank-repair] minIntervalMs:', minIntervalMs)
  console.log('[rank-repair] maxBatchesPerRun:', maxBatchesPerRun)
  console.log('[rank-repair] participantsUpdated:', participantsUpdated)
  console.log('[rank-repair] matchesRecomputed:', matchesRecomputed)
  console.log('[rank-repair] teamsRecomputed:', teamsRecomputed)

  const skipPollerRestart = ['1', 'true', 'yes', 'on'].includes(
    (process.env.RANK_REPAIR_SKIP_POLLER_RESTART ?? '').trim().toLowerCase()
  )
  if (skipPollerRestart) {
    console.log('[rank-repair] poller_restart: skipped (RANK_REPAIR_SKIP_POLLER_RESTART)')
    return
  }
  try {
    const { stdout, stderr } = await execFileAsync('pm2', ['restart', 'lelanation-poller'])
    if (stdout?.trim()) console.log('[rank-repair] poller_restart_stdout:', stdout.trim())
    if (stderr?.trim()) console.log('[rank-repair] poller_restart_stderr:', stderr.trim())
    console.log('[rank-repair] poller_restart: done')
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
