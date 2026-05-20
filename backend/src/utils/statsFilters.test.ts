import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRankTierWhere,
  buildRankTierSqlConditions,
  toQueryStringArrayParam,
} from './statsFilters.js'

test('toQueryStringArrayParam splits comma-separated rank string', () => {
  assert.deepEqual(toQueryStringArrayParam('GOLD,PLATINUM'), ['GOLD', 'PLATINUM'])
})

test('applyRankTierWhere uses IN for multiple tiers', () => {
  const w: Record<string, unknown> = {}
  applyRankTierWhere(w, ['GOLD', 'DIAMOND'])
  assert.deepEqual(w.rankTier, { in: ['GOLD', 'DIAMOND'] })
})

test('buildRankTierSqlConditions includes UNRANKED when no filter', () => {
  assert.deepEqual(buildRankTierSqlConditions('mo', null), [])
  assert.deepEqual(buildRankTierSqlConditions('mo', ''), [])
})

test('buildRankTierSqlConditions filters explicit tier', () => {
  assert.deepEqual(buildRankTierSqlConditions('mo', 'gold'), ['mo.rank_tier = \'GOLD\''])
})
