import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assignTiersFromNotes } from './tierListAssign.js'
import { deltaToMatchupBaseScore } from './MatchupTierService.js'

test('deltaToMatchupBaseScore applies Lolalytics bands', () => {
  assert.equal(deltaToMatchupBaseScore(-6), -10)
  assert.equal(deltaToMatchupBaseScore(-3), -6)
  assert.equal(deltaToMatchupBaseScore(-1), -3)
  assert.equal(deltaToMatchupBaseScore(0), 0)
  assert.equal(deltaToMatchupBaseScore(1.2), 3)
  assert.equal(deltaToMatchupBaseScore(4), 6)
  assert.equal(deltaToMatchupBaseScore(6.4), 10)
})

test('assignTiersFromNotes assigns B near zero score', () => {
  const notes = [0.4, 0.1, 0, -0.2, -0.35].sort((a, b) => b - a)
  const tiers = assignTiersFromNotes(notes)
  assert.deepEqual(tiers, ['A', 'B', 'B', 'B', 'C'])
})

test('assignTiersFromNotes empty returns empty', () => {
  assert.deepEqual(assignTiersFromNotes([]), [])
})
