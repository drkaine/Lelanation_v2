/**
 * Copy legacy `matchs` / `teams` / `match_players` (+ satellites) into `ingest_*` without deleting source rows.
 *
 * Idempotent: skips matches whose `riot_match_id` already exists in `ingest_matchs`.
 *
 * Env:
 *   MIGRATE_LEAN_BATCH_SIZE   — matches per batch (default 20)
 *   MIGRATE_LEAN_DRY_RUN=1    — only log what would be migrated
 *   MIGRATE_LEAN_ALL=1        — loop until no pending matches (default: single batch then exit)
 *
 * Usage:
 *   npx tsx src/scripts/migrateLegacyToIngestLean.ts
 */
import 'dotenv/config'
import { prisma } from '../db.js'
import type { Prisma } from '../generated/prisma/index.js'

function parseBatchSize(): number {
  const raw = parseInt(process.env.MIGRATE_LEAN_BATCH_SIZE ?? '', 100000000)
  if (!Number.isFinite(raw) || raw < 1) return 20
  return Math.min(500, raw)
}

function jsonSafe(v: unknown): unknown {
  if (v === null || v === undefined) return v
  if (typeof v === 'bigint') {
    const n = Number(v)
    if (Number.isSafeInteger(n)) return n
    return v.toString()
  }
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(jsonSafe)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(o)) out[k] = jsonSafe(val)
    return out
  }
  return v
}

function rowWithoutKeys<T extends Record<string, unknown>>(row: T, drop: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(row)) {
    if (drop.includes(k)) continue
    out[k] = jsonSafe(val)
  }
  return out
}

function buildLegacyPlayerStats(mp: {
  id: bigint
  core: Prisma.MatchPlayerCoreGetPayload<object> | null
  visions: Prisma.MatchPlayerVisionsGetPayload<object> | null
  matchup: Prisma.MatchPlayerMatchupGetPayload<object> | null
  objectives: Prisma.MatchPlayerObjectivesGetPayload<object> | null
  combats: Prisma.MatchPlayerCombatsGetPayload<object> | null
  challenges: Prisma.MatchPlayerChallengesGetPayload<object> | null
  buckets: Prisma.MatchPlayerBucketGetPayload<object>[]
}): Prisma.InputJsonValue {
  const buckets = mp.buckets.map((b) =>
    rowWithoutKeys(b as unknown as Record<string, unknown>, ['id', 'matchPlayerId'])
  )
  return {
    migratedFromLegacy: true,
    matchPlayerLegacyId: mp.id.toString(),
    core: mp.core ? rowWithoutKeys(mp.core as unknown as Record<string, unknown>, ['matchPlayerId']) : null,
    visions: mp.visions
      ? rowWithoutKeys(mp.visions as unknown as Record<string, unknown>, ['matchPlayerId'])
      : null,
    matchup: mp.matchup
      ? rowWithoutKeys(mp.matchup as unknown as Record<string, unknown>, ['matchPlayerId'])
      : null,
    objectives: mp.objectives
      ? rowWithoutKeys(mp.objectives as unknown as Record<string, unknown>, ['matchPlayerId'])
      : null,
    combats: mp.combats
      ? rowWithoutKeys(mp.combats as unknown as Record<string, unknown>, ['matchPlayerId'])
      : null,
    challenges: mp.challenges
      ? rowWithoutKeys(mp.challenges as unknown as Record<string, unknown>, ['matchPlayerId'])
      : null,
    timelineBuckets: buckets,
  } as Prisma.InputJsonValue
}

async function migrateOneMatch(matchId: bigint, dryRun: boolean): Promise<'ok' | 'skip' | 'error'> {
  const m = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      teams: { include: { bans: true } },
      drakeDetails: true,
      matchPlayers: {
        include: {
          team: { include: { bans: true } },
          core: true,
          visions: true,
          matchup: true,
          objectives: true,
          combats: true,
          challenges: true,
          buckets: { orderBy: { durationBucket: 'asc' } },
        },
      },
    },
  })
  if (!m) return 'skip'

  let teamsSource = m.teams
  if (teamsSource.length === 0 && m.matchPlayers.length > 0) {
    const byId = new Map<bigint, (typeof m.matchPlayers)[0]['team']>()
    for (const mp of m.matchPlayers) {
      if (mp.team) byId.set(mp.team.id, mp.team)
    }
    teamsSource = [...byId.values()]
  }

  if (teamsSource.length === 0 && m.matchPlayers.length > 0) {
    console.error(`[migrate] match ${m.riotMatchId}: no team rows, cannot map ingest_teams`)
    return 'error'
  }

  if (dryRun) {
    console.log(`[migrate] dry-run would copy ${m.riotMatchId} (${m.matchPlayers.length} players)`)
    return 'ok'
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const exists = await tx.ingestMatch.findUnique({
          where: { riotMatchId: m.riotMatchId },
          select: { id: true },
        })
        if (exists) return

        const im = await tx.ingestMatch.create({
          data: {
            riotMatchId: m.riotMatchId,
            gameVersion: m.gameVersion,
            gameDuration: m.gameDuration,
            gameDate: m.gameDate,
            rankTier: m.rankTier,
            rankDivision: m.rankDivision,
            gameEndedInSurrender: m.gameEndedInSurrender,
            gameEndedInEarlySurrender: m.gameEndedInEarlySurrender,
            region: m.region,
          },
        })

        const legacyTeamIdToNew = new Map<bigint, bigint>()
        for (const t of teamsSource) {
          const bans = (t.bans ?? [])
            .slice()
            .sort((a, b) => a.pickOrder - b.pickOrder)
            .map((b) => ({ championId: b.championId, pickOrder: b.pickOrder }))
          const drakes = m.drakeDetails
            .filter((d) => d.teamId === t.id)
            .sort((a, b) => a.order - b.order)
            .map((d) => ({ drakeType: d.drakeType, order: d.order, soul: d.soul }))
          const it = await tx.ingestTeam.create({
            data: {
              matchId: im.id,
              team: t.team,
              rankTier: t.rankTier,
              win: t.win,
              teamEarlySurrendered: t.teamEarlySurrendered,
              baronKills: t.baronKills,
              baronFirst: t.baronFirst,
              dragonKills: t.dragonKills,
              dragonFirst: t.dragonFirst,
              towerKills: t.towerKills,
              towerFirst: t.towerFirst,
              hordeKills: t.hordeKills,
              hordeFirst: t.hordeFirst,
              riftHeraldKills: t.riftHeraldKills,
              riftHeraldFirst: t.riftHeraldFirst,
              inhibitorKills: t.inhibitorKills,
              championKills: t.championKills,
              firstBlood: t.firstBlood,
              elderKills: t.elderKills,
              bansJson: bans as Prisma.InputJsonValue,
              drakesJson: drakes as Prisma.InputJsonValue,
            },
          })
          legacyTeamIdToNew.set(t.id, it.id)
        }

        const rows: Prisma.IngestMatchPlayerCreateManyInput[] = []
        for (const mp of m.matchPlayers) {
          const newTeamId = legacyTeamIdToNew.get(mp.teamId)
          if (newTeamId == null) {
            throw new Error(`No ingest team for legacy team_id=${mp.teamId} match=${m.riotMatchId}`)
          }
          const win = mp.team?.win ?? false
          const core = mp.core
          rows.push({
            matchId: im.id,
            playerId: mp.playerId,
            teamId: newTeamId,
            championId: mp.championId,
            role: mp.role,
            rankTier: mp.rankTier,
            rankDivision: mp.rankDivision,
            participantId: mp.participantId,
            items: mp.items as Prisma.InputJsonValue,
            runes: mp.runes,
            shards: mp.shards,
            summonerSpells: mp.summonerSpells,
            skillOrder: mp.skillOrder as Prisma.InputJsonValue | undefined,
            win,
            kills: core?.kills ?? 0,
            deaths: core?.deaths ?? 0,
            assists: core?.assists ?? 0,
            stats: buildLegacyPlayerStats(mp),
          })
        }
        if (rows.length > 0) {
          await tx.ingestMatchPlayer.createMany({ data: rows, skipDuplicates: true })
        }
      },
      { timeout: 120_000, maxWait: 10_000 }
    )
    return 'ok'
  } catch (e) {
    console.error(`[migrate] failed ${m.riotMatchId}:`, e instanceof Error ? e.message : String(e))
    return 'error'
  }
}

async function main(): Promise<void> {
  const dryRun = process.env.MIGRATE_LEAN_DRY_RUN === '1'
  const runAll = process.env.MIGRATE_LEAN_ALL === '1'
  const batchSize = parseBatchSize()

  let totalOk = 0
  let totalSkip = 0
  let totalErr = 0
  let batches = 0

  do {
    batches++
    const pending = await prisma.$queryRaw<Array<{ id: bigint }>>`
      SELECT m.id
      FROM matchs m
      WHERE NOT EXISTS (SELECT 1 FROM ingest_matchs i WHERE i.riot_match_id = m.riot_match_id)
      ORDER BY m.id ASC
      LIMIT ${batchSize}
    `
    if (pending.length === 0) {
      console.log('[migrate] no pending matches')
      break
    }
    console.log(`[migrate] batch ${batches}: ${pending.length} match(es)`)
    for (const row of pending) {
      const r = await migrateOneMatch(row.id, dryRun)
      if (r === 'ok') totalOk++
      else if (r === 'skip') totalSkip++
      else totalErr++
    }
    if (!runAll) break
  } while (true)

  console.log(
    `[migrate] done dryRun=${dryRun} ok=${totalOk} skip=${totalSkip} err=${totalErr} batches=${batches}`
  )
  if (totalErr > 0) process.exit(1)
}

void main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
