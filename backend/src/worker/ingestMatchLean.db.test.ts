import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prisma, isDatabaseConfigured } from '../db.js'
import type {
  RiotHttpClient,
  RiotMatchDto,
  RiotMatchTimelineDto,
  RiotParticipantDto,
} from '../services/RiotHttpClient.js'
import {
  upsertIngestMatchAndParticipants,
  extractIngestTimelineExtras,
} from './ingestMatchLean.js'

const mockRiotClient = {
  async getLeagueEntriesByPuuid() {
    return { ok: true as const, status: 200, data: [] }
  },
} as unknown as RiotHttpClient

const dbAvailable = isDatabaseConfigured()
const skipDbReason = dbAvailable ? false : 'DATABASE_URL not set (add backend/.env with DATABASE_URL to run)'

const fullCounters = () => ({
  matchesFetched: 0,
  participantsFetched: 0,
  playersFetched: 0,
  matchesApiIngestComplete: 0,
  playersRankUpdatedLeague: 0,
})

test('lean ingest creates ingest_* rows for new riot id', { skip: skipDbReason }, async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM ingest_matchs LIMIT 1`
  } catch {
    t.skip('Migration 20260416143000_ingest_lean_tables not applied (prisma migrate deploy)')
    return
  }
  const matchId = `EUW1_LEAN_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_LEAN_PUUID_${i}_${Date.now()}`)

  const dto: RiotMatchDto = {
    metadata: { matchId },
    info: {
      gameId: 123456700,
      gameDuration: 1800,
      gameVersion: '16.1.1',
      queueId: 420,
      endOfGameResult: 'GameComplete',
      participants: puuids.map((puuid, idx) => ({
        puuid,
        championId: 50 + idx,
        teamId: idx < 5 ? 100 : 200,
        win: idx < 5,
        kills: 1 + idx,
        deaths: 2,
        assists: 3,
      })),
    },
  }

  const counters = fullCounters()
  try {
    await upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters, undefined, {
      shouldAbort: () => false,
    })

    assert.equal(counters.matchesFetched, 1)
    assert.equal(counters.playersFetched, 10)
    assert.equal(counters.participantsFetched, 10)

    const ingest = await prisma.ingestMatch.findUnique({
      where: { riotMatchId: matchId },
      include: { matchPlayers: true, teams: true },
    })
    assert.ok(ingest, 'ingest_match should exist')
    assert.equal(ingest!.matchPlayers.length, 10)
    assert.ok(ingest!.teams.length >= 1)

    const oneP = ingest!.matchPlayers[0]!
    assert.equal(typeof oneP.kills, 'number')
    assert.ok(oneP.stats != null)

  } finally {
    const row = await prisma.ingestMatch.findUnique({ where: { riotMatchId: matchId } })
    if (row) await prisma.ingestMatch.delete({ where: { id: row.id } })
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

test('lean ingest idempotent: second upsert does not duplicate', { skip: skipDbReason }, async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM ingest_matchs LIMIT 1`
  } catch {
    t.skip('Migration 20260416143000_ingest_lean_tables not applied (prisma migrate deploy)')
    return
  }
  const matchId = `EUW1_LEAN_IDEMP_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_LEAN_IDEMP_${i}_${Date.now()}`)

  const dto: RiotMatchDto = {
    metadata: { matchId },
    info: {
      gameId: 123456701,
      gameDuration: 1600,
      gameVersion: '16.1.1',
      queueId: 420,
      endOfGameResult: 'GameComplete',
      participants: puuids.map((puuid, idx) => ({
        puuid,
        championId: 60 + idx,
        teamId: idx < 5 ? 100 : 200,
        win: idx >= 5,
      })),
    },
  }

  const c1 = fullCounters()
  const c2 = fullCounters()
  try {
    await upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', c1, undefined, {
      shouldAbort: () => false,
    })
    await upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', c2, undefined, {
      shouldAbort: () => false,
    })

    assert.equal(c1.matchesFetched, 1)
    assert.equal(c2.matchesFetched, 0)
    assert.equal(c2.participantsFetched, 0)

    const ingest = await prisma.ingestMatch.findUnique({
      where: { riotMatchId: matchId },
      include: { matchPlayers: true },
    })
    assert.ok(ingest)
    assert.equal(ingest!.matchPlayers.length, 10)
  } finally {
    const row = await prisma.ingestMatch.findUnique({ where: { riotMatchId: matchId } })
    if (row) await prisma.ingestMatch.delete({ where: { id: row.id } })
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

test('extractIngestTimelineExtras updates items on ingest_match_players', { skip: skipDbReason }, async (t) => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM ingest_matchs LIMIT 1`
  } catch {
    t.skip('Migration 20260416143000_ingest_lean_tables not applied (prisma migrate deploy)')
    return
  }
  const matchId = `EUW1_LEAN_TL_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_LEAN_TL_${i}_${Date.now()}`)

  const dto: RiotMatchDto = {
    metadata: { matchId },
    info: {
      gameId: 123456702,
      gameDuration: 900,
      gameVersion: '16.1.1',
      queueId: 420,
      endOfGameResult: 'GameComplete',
      participants: puuids.map((puuid, idx) => ({
        puuid,
        championId: 1,
        teamId: idx < 5 ? 100 : 200,
        win: idx < 5,
        summoner1Id: 4,
        summoner2Id: 14,
      })),
    },
  }

  const counters = fullCounters()
  try {
    const { matchDbId } = await upsertIngestMatchAndParticipants(
      mockRiotClient,
      'euw1',
      matchId,
      dto,
      'perso',
      counters,
      undefined,
      { shouldAbort: () => false }
    )

    const timeline = {
      info: {
        frames: [
          {
            timestamp: 60_000,
            events: [],
            participantFrames: Object.fromEntries(
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((pid) => [
                String(pid),
                {
                  participantId: pid,
                  currentGold: 500,
                  totalGold: 500,
                  level: 2,
                  xp: 400,
                  minionsKilled: 5,
                  jungleMinionsKilled: 0,
                  damageStats: {
                    magicDamageDone: 0,
                    physicalDamageDone: 100,
                    trueDamageDone: 0,
                    magicDamageDoneToChampions: 0,
                    physicalDamageDoneToChampions: 50,
                    trueDamageDoneToChampions: 0,
                    magicDamageTaken: 0,
                    physicalDamageTaken: 20,
                    trueDamageTaken: 0,
                    totalDamageDone: 100,
                    totalDamageDoneToChampions: 50,
                    totalDamageTaken: 20,
                  },
                  championStats: { timeEnemySpentControlled: 0 },
                },
              ])
            ),
          },
        ],
      },
    } as RiotMatchTimelineDto

    await extractIngestTimelineExtras(
      matchDbId,
      matchId,
      timeline,
      dto.info!.participants as RiotParticipantDto[],
      undefined
    )

    const mp = await prisma.ingestMatchPlayer.findFirst({
      where: { matchId: matchDbId, participantId: 1 },
    })
    assert.ok(mp)
    assert.ok(Array.isArray(mp!.items))
  } finally {
    const row = await prisma.ingestMatch.findUnique({ where: { riotMatchId: matchId } })
    if (row) await prisma.ingestMatch.delete({ where: { id: row.id } })
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})
