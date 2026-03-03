import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rankToScore,
  scoreToRank,
  formatRankString,
  rankStringToScore,
} from './rankScore.js'

test('rankToScore orders tiers and divisions', () => {
  assert.ok(rankToScore('IRON', 'IV', null) < rankToScore('IRON', 'I', null))
  assert.ok(rankToScore('IRON', 'I', null) < rankToScore('BRONZE', 'IV', null))
  assert.ok(rankToScore('GOLD', 'II', 50) > rankToScore('GOLD', 'II', 0))
})

test('scoreToRank inverts rankToScore when LP is null', () => {
  const cases: Array<[string, string | null]> = [
    ['GOLD', 'II'],
    ['IRON', 'IV'],
    ['CHALLENGER', 'I'],
  ]
  for (const [tier, division] of cases) {
    const score = rankToScore(tier, division, null)
    const { tier: t, division: d } = scoreToRank(score)
    assert.equal(t, tier)
    assert.equal(d, division ?? 'IV')
  }
})

test('formatRankString', () => {
  assert.equal(formatRankString('GOLD', 'II'), 'GOLD_II')
})

test('rankStringToScore parses RANK_DIVISION', () => {
  const s = rankStringToScore('GOLD_II')
  assert.ok(s > 0)
  assert.equal(scoreToRank(s).tier, 'GOLD')
  assert.equal(scoreToRank(s).division, 'II')
})
