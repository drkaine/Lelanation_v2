import 'dotenv/config'
import { prisma } from '../db.js'
import { rankToScore, scoreToRank } from '../utils/rankScore.js'

type MatchCandidate = { id: bigint }
type ParticipantRankRow = {
  id: bigint
  match_id: bigint
  team_id: bigint
  rank_tier: string | null
  rank_division: string | null
}

function isUsableTier(tier: string | null | undefined): boolean {
  const v = String(tier ?? '').trim().toUpperCase()
  return v !== '' && v !== 'UNRANKED'
}

function normalizedDivision(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim().toUpperCase()
  return v === '' ? null : v
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

async function countUnranked(): Promise<{ matches: number; teams: number }> {
  const [m, t] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM ingest_matchs WHERE COALESCE(NULLIF(TRIM(rank_tier), ''), 'UNRANKED') = 'UNRANKED'`
    ),
    prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*)::bigint AS c FROM ingest_teams WHERE COALESCE(NULLIF(TRIM(rank_tier), ''), 'UNRANKED') = 'UNRANKED'`
    ),
  ])
  return {
    matches: Number(m[0]?.c ?? 0),
    teams: Number(t[0]?.c ?? 0),
  }
}

async function main(): Promise<void> {
  const batchSize = Math.max(100, Math.min(5000, Number(process.env.RECOMPUTE_INGEST_RANKS_BATCH ?? 1000)))
  console.log('[recompute-ingest-ranks] batchSize:', batchSize)

  const before = await countUnranked()
  console.log('[recompute-ingest-ranks] before matches_unranked:', before.matches)
  console.log('[recompute-ingest-ranks] before teams_unranked:', before.teams)

  let totalMatchesUpdated = 0
  let totalTeamsUpdated = 0

  let lastSeenId = 0n
  while (true) {
    const candidates = await prisma.$queryRawUnsafe<MatchCandidate[]>(`
      SELECT im.id
      FROM ingest_matchs im
      WHERE im.id > ${lastSeenId.toString()}
        AND (
          COALESCE(NULLIF(TRIM(im.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
         OR EXISTS (
            SELECT 1
            FROM ingest_teams it
            WHERE it.match_id = im.id
              AND COALESCE(NULLIF(TRIM(it.rank_tier), ''), 'UNRANKED') = 'UNRANKED'
          )
        )
      ORDER BY im.id
      LIMIT ${batchSize}
    `)
    if (candidates.length === 0) break

    const matchIds = candidates.map((r) => r.id)
    lastSeenId = matchIds[matchIds.length - 1] ?? lastSeenId
    const idListSql = matchIds.map((id) => id.toString()).join(',')
    const rows = await prisma.$queryRawUnsafe<ParticipantRankRow[]>(`
      SELECT
        imp.id,
        imp.match_id,
        imp.team_id,
        imp.rank_tier,
        imp.rank_division
      FROM ingest_match_players imp
      WHERE imp.match_id IN (${idListSql})
    `)

    const byMatch = new Map<string, ParticipantRankRow[]>()
    for (const row of rows) {
      const key = row.match_id.toString()
      const arr = byMatch.get(key) ?? []
      arr.push(row)
      byMatch.set(key, arr)
    }

    for (const matchId of matchIds) {
      const participants = byMatch.get(matchId.toString()) ?? []
      if (participants.length === 0) continue

      const knownScoresByTeam = new Map<string, number[]>()
      const knownMatchScores: number[] = []
      for (const p of participants) {
        if (!isUsableTier(p.rank_tier)) continue
        const tier = String(p.rank_tier).trim().toUpperCase()
        const division = normalizedDivision(p.rank_division)
        const score = rankToScore(tier, division, null)
        knownMatchScores.push(score)
        const key = p.team_id.toString()
        const arr = knownScoresByTeam.get(key) ?? []
        arr.push(score)
        knownScoresByTeam.set(key, arr)
      }

      const matchAvgScore = avg(knownMatchScores)
      let inferredParticipantsUpdated = 0
      for (const p of participants) {
        if (isUsableTier(p.rank_tier)) continue
        const teamAvgScore = avg(knownScoresByTeam.get(p.team_id.toString()) ?? [])
        const sourceScore = teamAvgScore ?? matchAvgScore
        if (sourceScore == null) continue
        const inferred = scoreToRank(sourceScore)
        await prisma.ingestMatchPlayer.update({
          where: { id: p.id },
          data: { rankTier: inferred.tier, rankDivision: inferred.division },
        })
        p.rank_tier = inferred.tier
        p.rank_division = inferred.division
        inferredParticipantsUpdated++
      }

      const matchScores: number[] = []
      const teamScores = new Map<string, number[]>()
      for (const p of participants) {
        if (!isUsableTier(p.rank_tier)) continue
        const tier = String(p.rank_tier).trim().toUpperCase()
        const division = p.rank_division ? String(p.rank_division).trim().toUpperCase() : null
        const score = rankToScore(tier, division, null)
        matchScores.push(score)
        const k = p.team_id.toString()
        const arr = teamScores.get(k) ?? []
        arr.push(score)
        teamScores.set(k, arr)
      }

      if (matchScores.length > 0) {
        const avg = matchScores.reduce((a, b) => a + b, 0) / matchScores.length
        const rank = scoreToRank(avg)
        await prisma.ingestMatch.update({
          where: { id: matchId },
          data: { rankTier: rank.tier, rankDivision: rank.division },
        })
        totalMatchesUpdated++
      }

      for (const [teamIdStr, scores] of teamScores.entries()) {
        if (scores.length === 0) continue
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        const rank = scoreToRank(avg)
        await prisma.ingestTeam.update({
          where: { id: BigInt(teamIdStr) },
          data: { rankTier: rank.tier },
        })
        totalTeamsUpdated++
      }

      if (inferredParticipantsUpdated > 0) {
        console.log(
          `[recompute-ingest-ranks] inferred participants matchId=${matchId.toString()} count=${inferredParticipantsUpdated}`
        )
      }
    }

    console.log(
      `[recompute-ingest-ranks] processed batch=${candidates.length} totalMatchesUpdated=${totalMatchesUpdated} totalTeamsUpdated=${totalTeamsUpdated}`
    )
  }

  const after = await countUnranked()
  console.log('[recompute-ingest-ranks] after matches_unranked:', after.matches)
  console.log('[recompute-ingest-ranks] after teams_unranked:', after.teams)
  console.log('[recompute-ingest-ranks] delta matches:', before.matches - after.matches)
  console.log('[recompute-ingest-ranks] delta teams:', before.teams - after.teams)
}

void main()
  .catch((err) => {
    console.error('[recompute-ingest-ranks] failed:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
