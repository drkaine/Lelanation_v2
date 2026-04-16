import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prisma, isDatabaseConfigured } from '../db.js'
import type { RiotHttpClient, RiotMatchDto } from '../services/RiotHttpClient.js'
import { upsertIngestMatchAndParticipants } from './ingestMatchLean.js'

/** Minimal stub: upsert only needs league entries when rank API is triggered. */
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

test('upsertIngestMatchAndParticipants inserts ingest match and players', { skip: skipDbReason }, async () => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM ingest_matchs LIMIT 1`
  } catch {
    return
  }
  const matchId = `EUW1_POLLER_TEST_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_POLLER_PUUID_${i}_${Date.now()}`)

  const dto: RiotMatchDto = {
    metadata: { matchId },
    info: {
      gameId: 123456789,
      gameDuration: 1800,
      gameVersion: '16.1.1',
      queueId: 420,
      endOfGameResult: 'GameComplete',
      participants: puuids.map((puuid, idx) => ({
        puuid,
        championId: 10 + idx,
        teamId: idx < 5 ? 100 : 200,
        win: idx < 5,
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

    const match = await prisma.ingestMatch.findUnique({
      where: { riotMatchId: matchId },
      include: { matchPlayers: true },
    })
    assert.ok(match, 'ingest_match should be created')
    assert.equal(match!.matchPlayers.length, 10)

    const players = await prisma.player.findMany({
      where: { puuid: { in: puuids } },
    })
    assert.equal(players.length, 10)
  } finally {
    const row = await prisma.ingestMatch.findUnique({ where: { riotMatchId: matchId } })
    if (row) await prisma.ingestMatch.delete({ where: { id: row.id } })
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

test('upsertIngestMatchAndParticipants is idempotent on existing riot_match_id', { skip: skipDbReason }, async () => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM ingest_matchs LIMIT 1`
  } catch {
    return
  }
  const matchId = `EUW1_POLLER_IDEMP_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_POLLER_IDEMP_${i}_${Date.now()}`)

  const dto: RiotMatchDto = {
    metadata: { matchId },
    info: {
      gameId: 987654321,
      gameDuration: 1500,
      gameVersion: '16.1.1',
      queueId: 420,
      endOfGameResult: 'GameComplete',
      participants: puuids.map((puuid, idx) => ({
        puuid,
        championId: 100 + idx,
        teamId: idx < 5 ? 100 : 200,
        win: idx >= 5,
      })),
    },
  }

  const counters1 = fullCounters()
  const counters2 = fullCounters()

  try {
    await upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters1, undefined, {
      shouldAbort: () => false,
    })
    await upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters2, undefined, {
      shouldAbort: () => false,
    })

    assert.equal(counters1.matchesFetched, 1)
    assert.equal(counters2.matchesFetched, 0)
    assert.equal(counters2.participantsFetched, 0)

    const match = await prisma.ingestMatch.findUnique({
      where: { riotMatchId: matchId },
      include: { matchPlayers: true },
    })
    assert.ok(match)
    assert.equal(match!.matchPlayers.length, 10)
  } finally {
    const row = await prisma.ingestMatch.findUnique({ where: { riotMatchId: matchId } })
    if (row) await prisma.ingestMatch.delete({ where: { id: row.id } })
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

test('upsertIngestMatchAndParticipants handles concurrent duplicate insert safely', { skip: skipDbReason }, async () => {
  try {
    await prisma.$queryRaw`SELECT 1 FROM ingest_matchs LIMIT 1`
  } catch {
    return
  }
  const suffix = Date.now()
  const matchId = `EUW1_POLLER_RACE_${suffix}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_POLLER_RACE_${i}_${suffix}`)

  const dto: RiotMatchDto = {
    metadata: { matchId },
    info: {
      gameId: 111222333,
      gameDuration: 1700,
      gameVersion: '16.1.1',
      queueId: 420,
      endOfGameResult: 'GameComplete',
      participants: puuids.map((puuid, idx) => ({
        puuid,
        championId: 200 + idx,
        teamId: idx < 5 ? 100 : 200,
        win: idx % 2 === 0,
      })),
    },
  }

  const counters1 = fullCounters()
  const counters2 = fullCounters()

  try {
    await Promise.all([
      upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters1, undefined, {
        shouldAbort: () => false,
      }),
      upsertIngestMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters2, undefined, {
        shouldAbort: () => false,
      }),
    ])

    const matches = await prisma.ingestMatch.findMany({ where: { riotMatchId: matchId } })
    assert.equal(matches.length, 1, 'exactly one ingest_match row')
    const participants = await prisma.ingestMatchPlayer.count({ where: { matchId: matches[0]!.id } })
    assert.equal(participants, 10)
  } finally {
    const row = await prisma.ingestMatch.findUnique({ where: { riotMatchId: matchId } })
    if (row) await prisma.ingestMatch.delete({ where: { id: row.id } })
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})
