import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemTierRoleBucket, itemTierRoleGameWinCounts } from './itemTierDailySnapshotRole.js'

test('itemTierRoleBucket normalizes lane labels', () => {
  assert.equal(itemTierRoleBucket('TOP'), 'top')
  assert.equal(itemTierRoleBucket('JUNGLE'), 'jungle')
  assert.equal(itemTierRoleBucket('MIDDLE'), 'mid')
  assert.equal(itemTierRoleBucket('ADC'), 'adc')
  assert.equal(itemTierRoleBucket('UTILITY'), 'support')
  assert.equal(itemTierRoleBucket('UNKNOWN'), null)
})

test('itemTierRoleGameWinCounts increments one lane only', () => {
  assert.deepEqual(itemTierRoleGameWinCounts('MID', 1), {
    top_game: 0,
    top_win: 0,
    jungle_game: 0,
    jungle_win: 0,
    mid_game: 1,
    mid_win: 1,
    adc_game: 0,
    adc_win: 0,
    support_game: 0,
    support_win: 0,
  })
  assert.deepEqual(itemTierRoleGameWinCounts('TOP', 0).top_win, 0)
})
