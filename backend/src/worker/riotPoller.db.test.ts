import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prisma, isDatabaseConfigured } from '../db.js'
import type { RiotHttpClient, RiotMatchDto } from '../services/RiotHttpClient.js'
import { upsertMatchAndParticipants } from './riotPoller.js'

/** Minimal stub: upsert only needs league entries when rank API is triggered. */
const mockRiotClient = {
  async getLeagueEntriesByPuuid() {
    return { ok: true as const, status: 200, data: [] }
  },
} as unknown as RiotHttpClient

const dbAvailable = isDatabaseConfigured()
const skipDbReason = dbAvailable ? false : 'DATABASE_URL not set (add backend/.env with DATABASE_URL to run)'

test('upsertMatchAndParticipants inserts match, players and participants', { skip: skipDbReason }, async () => {
  const matchId = `EUW1_TEST_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_PUUID_${i}_${Date.now()}`)

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

  const counters = { matchesFetched: 0, participantsFetched: 0, playersFetched: 0 }

  try {
    await upsertMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters)

    assert.equal(counters.matchesFetched, 1)
    assert.equal(counters.playersFetched, 10)
    assert.equal(counters.participantsFetched, 10)

    const match = await prisma.match.findUnique({
      where: { riotMatchId: matchId },
      include: { matchPlayers: true },
    })
    assert.ok(match, 'match should be created')
    assert.equal(match!.matchPlayers.length, 10)

    const players = await prisma.player.findMany({
      where: { puuid: { in: puuids } },
    })
    assert.equal(players.length, 10)
  } finally {
    // Cleanup: remove test data from DB so tests don't pollute production stats.
    const match = await prisma.match.findUnique({ where: { riotMatchId: matchId } })
    if (match) {
      await prisma.match.delete({ where: { id: match.id } })
    }
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

test('upsertMatchAndParticipants is idempotent on existing matchId', { skip: skipDbReason }, async () => {
  const matchId = `EUW1_TEST_IDEMP_${Date.now()}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_PUUID_IDEMP_${i}_${Date.now()}`)

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

  const counters1 = { matchesFetched: 0, participantsFetched: 0, playersFetched: 0 }
  const counters2 = { matchesFetched: 0, participantsFetched: 0, playersFetched: 0 }

  try {
    await upsertMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters1)
    await upsertMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters2)

    assert.equal(counters1.matchesFetched, 1)
    assert.equal(counters1.playersFetched, 10)
    assert.equal(counters1.participantsFetched, 10)

    // Second call should be a no-op (match already exists).
    assert.equal(counters2.matchesFetched, 0)
    assert.equal(counters2.playersFetched, 0)
    assert.equal(counters2.participantsFetched, 0)

    const match = await prisma.match.findUnique({
      where: { riotMatchId: matchId },
      include: { matchPlayers: true },
    })
    assert.ok(match, 'match should exist')
    assert.equal(match!.matchPlayers.length, 10)
  } finally {
    const match = await prisma.match.findUnique({ where: { riotMatchId: matchId } })
    if (match) {
      await prisma.match.delete({ where: { id: match.id } })
    }
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

test('upsertMatchAndParticipants handles concurrent duplicate match insert safely', { skip: skipDbReason }, async () => {
  const suffix = Date.now()
  const matchId = `EUW1_TEST_RACE_${suffix}`
  const puuids = Array.from({ length: 10 }, (_, i) => `TEST_PUUID_RACE_${i}_${suffix}`)

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

  const counters1 = {
    matchesFetched: 0,
    participantsFetched: 0,
    playersFetched: 0,
    matchesApiIngestComplete: 0,
    playersRankUpdatedLeague: 0,
  }
  const counters2 = {
    matchesFetched: 0,
    participantsFetched: 0,
    playersFetched: 0,
    matchesApiIngestComplete: 0,
    playersRankUpdatedLeague: 0,
  }

  try {
    await Promise.all([
      upsertMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters1),
      upsertMatchAndParticipants(mockRiotClient, 'euw1', matchId, dto, 'perso', counters2),
    ])

    const matches = await prisma.match.findMany({ where: { riotMatchId: matchId } })
    assert.equal(matches.length, 1, 'exactly one match row should exist')
    const participants = await prisma.matchPlayer.count({ where: { matchId: matches[0]!.id } })
    assert.equal(participants, 10, 'exactly 10 participants should be present')
  } finally {
    const match = await prisma.match.findUnique({ where: { riotMatchId: matchId } })
    if (match) {
      await prisma.match.delete({ where: { id: match.id } })
    }
    await prisma.player.deleteMany({ where: { puuid: { in: puuids } } })
  }
})

