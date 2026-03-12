import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __testables } from './TierListService.js'

test('computePbi matches statsFormulas.pbi', () => {
  const { computePbi } = __testables
  assert.ok(Math.abs(computePbi(55, 10, 20) - 0.625) < 1e-9)
  assert.equal(computePbi(50, 10, 20), 0)
  assert.equal(computePbi(55, 10, 100), 0)
})

test('tierScoreFromWinrateAndGames', () => {
  const { tierScoreFromWinrateAndGames } = __testables
  assert.equal(tierScoreFromWinrateAndGames(0.5, 100), 0)
  assert.ok(Math.abs(tierScoreFromWinrateAndGames(0.6, 100) - 1) < 1e-9)
  assert.ok(Math.abs(tierScoreFromWinrateAndGames(0.4, 100) - (-1)) < 1e-9)
})

test('assignTier assigns by percentile rank', () => {
  const { assignTier } = __testables
  // 20 rows: top 5% → S+, next 5% → S, next 15% → A, etc.
  const sorted = Array.from({ length: 20 }, (_, i) => ({ tierScore: 20 - i }))
  const tiers = assignTier(sorted)
  assert.equal(tiers.length, 20)
  // 1st = 5% → S+, 2nd = 10% → S (cumul 10%), 3-5 = 15%, 6 = 30% → A, ...
  assert.equal(tiers[0], 'S+')
  assert.equal(tiers[1], 'S')
  assert.equal(tiers[4], 'A') // 5/20 = 25% → A (maxPct 25)
  assert.equal(tiers[9], 'B') // 10/20 = 50%
  assert.equal(tiers[14], 'C') // 15/20 = 75%
  assert.equal(tiers[19], 'D') // 20/20 = 100%
})

test('assignTier empty returns empty', () => {
  const { assignTier } = __testables
  assert.deepEqual(assignTier([]), [])
})
