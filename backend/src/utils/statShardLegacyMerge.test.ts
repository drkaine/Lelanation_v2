import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeLegacyStatShardAggregates } from './statShardLegacyMerge.js'

test('mergeLegacyStatShardAggregates: 5006 flex → 5010', () => {
  const m = new Map<string, { wins: number; games: number }>()
  m.set('5006:1', { wins: 4, games: 10 })
  mergeLegacyStatShardAggregates(m)
  assert.deepEqual(m.get('5010:1'), { wins: 4, games: 10 })
  assert.equal(m.has('5006:1'), false)
})

test('mergeLegacyStatShardAggregates: cumule avec id cible déjà présent', () => {
  const m = new Map<string, { wins: number; games: number }>()
  m.set('5010:1', { wins: 1, games: 5 })
  m.set('5006:1', { wins: 2, games: 5 })
  mergeLegacyStatShardAggregates(m)
  assert.deepEqual(m.get('5010:1'), { wins: 3, games: 10 })
})
