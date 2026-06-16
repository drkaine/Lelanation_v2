import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeChampionVsLaneMetrics } from './championVsLaneMetrics.js'
import type { MatchTimelineEventDto, MatchTimelineFrameDto, ParticipantDto } from '../riot/types.js'

function frame(minute: number, participants: Record<string, { totalGold: number; currentGold: number; cs: number; level: number; xp: number }>) {
  const participantFrames: MatchTimelineFrameDto['participantFrames'] = {}
  for (const [id, stats] of Object.entries(participants)) {
    participantFrames[id] = {
      participantId: Number(id),
      totalGold: stats.totalGold,
      currentGold: stats.currentGold,
      minionsKilled: stats.cs,
      jungleMinionsKilled: 0,
      level: stats.level,
      xp: stats.xp,
      position: { x: 0, y: 0 },
      timeEnemySpentControlled: 0,
      damageStats: {},
    } as MatchTimelineFrameDto['participantFrames'][string]
  }
  return {
    timestamp: minute * 60_000,
    events: [],
    participantFrames,
  } satisfies MatchTimelineFrameDto
}

function participant(id: number, teamId: 100 | 200): ParticipantDto {
  return {
    participantId: id,
    teamId,
    championId: id * 10,
    win: true,
    item0: 0,
    item1: 0,
    item2: 0,
    item3: 0,
    item4: 0,
    item5: 0,
  } as ParticipantDto
}

test('computeChampionVsLaneMetrics gold and kill diffs at 5 min', () => {
  const frames = [
    frame(1, {
      '1': { totalGold: 500, currentGold: 100, cs: 10, level: 1, xp: 0 },
      '6': { totalGold: 400, currentGold: 80, cs: 8, level: 1, xp: 0 },
    }),
    frame(5, {
      '1': { totalGold: 2500, currentGold: 500, cs: 42, level: 5, xp: 2000 },
      '6': { totalGold: 2100, currentGold: 400, cs: 35, level: 4, xp: 1700 },
    }),
  ]
  const events: MatchTimelineEventDto[] = [
    {
      type: 'CHAMPION_KILL',
      timestamp: 4 * 60_000,
      killerId: 1,
      victimId: 6,
      assistingParticipantIds: [],
    },
  ]

  const metrics = computeChampionVsLaneMetrics({
    frames,
    events,
    participantId: 1,
    opponentParticipantId: 6,
    participantTeamId: 100,
    opponentTeamId: 200,
    participant: participant(1, 100),
    opponent: participant(6, 200),
    participantItems: [],
    opponentItems: [],
    finalInventorySet: new Set(),
    opponentFinalInventorySet: new Set(),
  })

  assert.equal(metrics.sum_gold_difference_5min, 400)
  assert.equal(metrics.sum_cs_difference_5min, 7)
  assert.equal(metrics.sum_kill_opponent_5min, 1)
  assert.equal(metrics.sum_death_by_opponent_5min, 0)
})
