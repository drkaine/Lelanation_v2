import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __testables } from './TierListService.js'

test('deltaToMatchupBaseScore applies Lolalytics bands', () => {
  const { deltaToMatchupBaseScore } = __testables
  assert.equal(deltaToMatchupBaseScore(-6), -10)
  assert.equal(deltaToMatchupBaseScore(-3), -6)
  assert.equal(deltaToMatchupBaseScore(-1), -3)
  assert.equal(deltaToMatchupBaseScore(0), 0)
  assert.equal(deltaToMatchupBaseScore(1.2), 3)
  assert.equal(deltaToMatchupBaseScore(4), 6)
  assert.equal(deltaToMatchupBaseScore(6.4), 10)
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

test('assignTier keeps same tier for equal score ties', () => {
  const { assignTier } = __testables
  const sorted = [
    { tierScore: 100 },
    { tierScore: 99 },
    { tierScore: 98 },
    { tierScore: 97 },
    { tierScore: 96 },
    { tierScore: 95 },
    { tierScore: 94 },
    { tierScore: 93 },
    { tierScore: 92 },
    { tierScore: 91 },
    { tierScore: 90 },
    { tierScore: 89 },
    { tierScore: 88 },
    { tierScore: 87 },
    { tierScore: 86 },
    { tierScore: 85 },
    { tierScore: 84 },
    { tierScore: 83 },
    { tierScore: 82 },
    { tierScore: 82 },
  ]
  const tiers = assignTier(sorted)
  assert.equal(tiers[18], tiers[19])
})

test('assignTier keeps all tiers represented on large cohorts', () => {
  const { assignTier } = __testables
  const sorted = Array.from({ length: 40 }, (_, i) => ({ tierScore: 100 - i }))
  const tiers = assignTier(sorted)
  assert.ok(tiers.includes('S+'))
  assert.ok(tiers.includes('S'))
  assert.ok(tiers.includes('A'))
  assert.ok(tiers.includes('B'))
  assert.ok(tiers.includes('C'))
  assert.ok(tiers.includes('D'))
})
