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
