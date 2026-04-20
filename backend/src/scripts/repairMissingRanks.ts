import 'dotenv/config'
import { prisma } from '../db.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { RiotHttpClient, resolveRiotApiKey, type RiotLeagueEntryDto } from '../services/RiotHttpClient.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'

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

async function recomputeMatchRanksForPlayerIds(playerIds: bigint[]): Promise<number> {
  if (playerIds.length === 0) return 0
  const rows = await prisma.ingestMatchPlayer.findMany({
    where: { playerId: { in: playerIds } },
    select: { matchId: true },
  })
  const matchIds = [...new Set(rows.map((r) => r.matchId.toString()))].map((s) => BigInt(s))
  let fixed = 0
  for (const matchId of matchIds) {
    const participants = await prisma.ingestMatchPlayer.findMany({
      where: { matchId },
      select: { rankTier: true, rankDivision: true },
    })
    const scores: number[] = []
    for (const p of participants) {
      if (p.rankTier && p.rankTier !== 'UNRANKED') {
        scores.push(rankToScore(p.rankTier, p.rankDivision ?? null, null))
      }
    }
    if (scores.length === 0) continue
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const r = scoreToRank(avg)
    await prisma.ingestMatch.update({
      where: { id: matchId },
      data: { rankTier: r.tier, rankDivision: r.division },
    })
    fixed++
  }
  return fixed
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
  const candidates = await prisma.$queryRaw<
    Array<{ id: bigint; puuid: string; region: string }>
  >`
    SELECT DISTINCT p.id, p.puuid, p.region
    FROM players p
    INNER JOIN ingest_match_players imp ON imp.player_id = p.id
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    WHERE im.rank_tier = 'UNRANKED'
      AND (p.rank_tier IS NULL OR p.rank_tier = 'UNRANKED')
    ORDER BY p.id
    LIMIT ${batchSize}
  `

  let playersUpdated = 0
  const updatedPlayerIds: bigint[] = []
  for (const p of candidates) {
    if (!isLikelyRiotPuuid(p.puuid)) continue
    const platform = p.region.toLowerCase()
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

    await prisma.player.update({
      where: { id: p.id },
      data: {
        rankTier,
        rankDivision,
        rankLp,
        rankSnapshotGameDate: new Date(),
      },
    })
    await prisma.ingestMatchPlayer.updateMany({
      where: { playerId: p.id, rankTier: 'UNRANKED' },
      data: { rankTier, rankDivision },
    })
    updatedPlayerIds.push(p.id)
    playersUpdated++
  }

  const matchesRecomputed = await recomputeMatchRanksForPlayerIds(updatedPlayerIds)

  console.log('[rank-repair] candidates:', candidates.length)
  console.log('[rank-repair] playersUpdated:', playersUpdated)
  console.log('[rank-repair] matchesRecomputed:', matchesRecomputed)
}

void main()
  .catch((err) => {
    console.error('[rank-repair] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
