// @ts-nocheck
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __testables, patchFromGameVersion } from './MatchupTierService.js'

test('patchFromGameVersion extracts major.minor', () => {
  assert.equal(patchFromGameVersion('16.4.123.456'), '16.4')
  assert.equal(patchFromGameVersion('15.12.1'), '15.12')
  assert.equal(patchFromGameVersion(''), null)
  assert.equal(patchFromGameVersion('invalid'), null)
})

test('score stays in -10..+10 and positive when outperforming', () => {
  const strong = __testables.computeScoreFromAggregates(120, 80, 4.5, 16)
  assert.ok(strong.score <= 10 && strong.score >= -10)
  assert.ok(strong.score > 0)
  assert.ok(strong.confidence > 0.9)

  const weak = __testables.computeScoreFromAggregates(120, 40, 1.8, 12)
  assert.ok(weak.score < 0)
  assert.ok(weak.score >= -10)
})

test('buildMatchupRows creates mirrored lane-vs-lane rows', () => {
  const rows = __testables.buildMatchupRows({
    patch: '16.4',
    matchRank: 'GOLD_II',
    participants: [
      { championId: 266, teamId: 100, role: 'TOP', win: true, kills: 6, deaths: 2, assists: 5, champLevel: 16 },
      { championId: 24, teamId: 200, role: 'TOP', win: false, kills: 2, deaths: 6, assists: 3, champLevel: 14 },
    ],
  })
  const globalAatrox = rows.find(
    (r) =>
      r.rankFilterKey === 'GLOBAL' &&
      r.lane === 'TOP' &&
      r.championId === 266 &&
      r.opponentChampionId === 24
  )
  const goldAatrox = rows.find(
    (r) =>
      r.rankFilterKey === 'GOLD' &&
      r.lane === 'TOP' &&
      r.championId === 266 &&
      r.opponentChampionId === 24
  )
  const globalJax = rows.find(
    (r) =>
      r.rankFilterKey === 'GLOBAL' &&
      r.lane === 'TOP' &&
      r.championId === 24 &&
      r.opponentChampionId === 266
  )
  assert.ok(globalAatrox)
  assert.ok(goldAatrox)
  assert.ok(globalJax)
  assert.equal(globalAatrox?.wins, 1)
  assert.equal(globalJax?.wins, 0)
})

test('deltaToMatchupBaseScore maps Delta to -10,-6,-3,0,3,6,10 bands', () => {
  const { deltaToMatchupBaseScore } = __testables
  assert.equal(deltaToMatchupBaseScore(-6), -10)
  assert.equal(deltaToMatchupBaseScore(-5), -6)
  assert.equal(deltaToMatchupBaseScore(-3), -6)
  assert.equal(deltaToMatchupBaseScore(-2), -3)
  assert.equal(deltaToMatchupBaseScore(-1), -3)
  assert.equal(deltaToMatchupBaseScore(-0.5), 0)
  assert.equal(deltaToMatchupBaseScore(0), 0)
  assert.equal(deltaToMatchupBaseScore(0.5), 0)
  assert.equal(deltaToMatchupBaseScore(1), 3)
  assert.equal(deltaToMatchupBaseScore(2), 3)
  assert.equal(deltaToMatchupBaseScore(3), 6)
  assert.equal(deltaToMatchupBaseScore(5), 6)
  assert.equal(deltaToMatchupBaseScore(6), 10)
})

test('matchupScoreFromDeltaAndWeight applies pondération', () => {
  const { matchupScoreFromDeltaAndWeight } = __testables
  // Delta 4 → base 6. Si 100 games dans le matchup et 500 total → weight 0.2 → score 1.2
  assert.ok(Math.abs(matchupScoreFromDeltaAndWeight({ delta: 4, gamesInMatchup: 100, totalGamesChampion: 500 }) - 1.2) < 1e-9)
  // delta -3 → base -6, weight 50/200 = 0.25 → -1.5
  assert.ok(Math.abs(matchupScoreFromDeltaAndWeight({ delta: -3, gamesInMatchup: 50, totalGamesChampion: 200 }) - (-1.5)) < 1e-9)
  assert.equal(matchupScoreFromDeltaAndWeight({ delta: 1, gamesInMatchup: 10, totalGamesChampion: 0 }), 0)
})

test('computeDelta is winrate A vs B minus avg others vs B', () => {
  const { computeDelta } = __testables
  assert.equal(computeDelta(54, 50), 4)
  assert.equal(computeDelta(46, 50), -4)
})
