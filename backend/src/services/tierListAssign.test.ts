import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignTiersFromNotes,
  scaledTierNote,
  TIER_BAND_B_HALF,
  TIER_EXTREME_GAP_SCALED,
  TIER_EXTREME_MAX,
  TIER_NOTE_SCORE_SCALE,
} from './tierListAssign.js'

test('scaledTierNote matches tier-list UI scale', () => {
  assert.equal(scaledTierNote(0.42), 42)
  assert.equal(TIER_NOTE_SCORE_SCALE, 100)
})

test('assignTiersFromNotes puts score-near-zero champions in B', () => {
  const notes = [0.5, 0.2, 0.05, -0.1, -0.3, 0.15].sort((a, b) => b - a)
  const tiers = assignTiersFromNotes(notes)
  assert.deepEqual(tiers, ['A', 'B', 'B', 'B', 'B', 'B'])
})

test('assignTiersFromNotes caps S+ at 5 with gap from last S rank', () => {
  const notes = Array.from({ length: 12 }, (_, i) => 2.0 - i * 0.05).sort((a, b) => b - a)
  const tiers = assignTiersFromNotes(notes)
  const sPlus = tiers.filter((t) => t === 'S+').length
  assert.ok(sPlus <= TIER_EXTREME_MAX)
  assert.ok(sPlus >= 1)

  const minS = Math.min(
    ...notes.filter((_, i) => tiers[i] === 'S').map((n) => scaledTierNote(n)),
    TIER_BAND_B_HALF * 2,
  )
  const sPlusScores = notes.filter((_, i) => tiers[i] === 'S+').map((n) => scaledTierNote(n))
  for (const s of sPlusScores) {
    assert.ok(s >= minS + TIER_EXTREME_GAP_SCALED - 1e-9)
  }
})

test('assignTiersFromNotes caps D at 5 with gap from lowest C', () => {
  const notes = Array.from({ length: 12 }, (_, i) => -0.2 - i * 0.08).sort((a, b) => b - a)
  const tiers = assignTiersFromNotes(notes)
  const dCount = tiers.filter((t) => t === 'D').length
  assert.ok(dCount <= TIER_EXTREME_MAX)
})

test('assignTiersFromNotes avoids percentile-style all S+ and all D for flat mid cohort', () => {
  const notes = [
    ...Array.from({ length: 8 }, () => 0.02),
    ...Array.from({ length: 8 }, () => -0.02),
    ...Array.from({ length: 8 }, () => 0.0),
  ].sort((a, b) => b - a)
  const tiers = assignTiersFromNotes(notes)
  assert.equal(tiers.filter((t) => t === 'S+').length, 0)
  assert.equal(tiers.filter((t) => t === 'D').length, 0)
  assert.ok(tiers.filter((t) => t === 'B').length >= 20)
})
