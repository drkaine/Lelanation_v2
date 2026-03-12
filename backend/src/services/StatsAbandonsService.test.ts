import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeAbandonRates } from './StatsAbandonsService.js'

test('computeAbandonRates when total is 0', () => {
  const r = computeAbandonRates(0, 0, 0, 0)
  assert.equal(r.remakeRate, 0)
  assert.equal(r.earlySurrenderRate, 0)
  assert.equal(r.surrenderRate, 0)
})

test('computeAbandonRates computes rates as 100 * count / total', () => {
  const r = computeAbandonRates(1000, 50, 100, 200)
  assert.equal(r.remakeRate, 5)
  assert.equal(r.earlySurrenderRate, 10)
  assert.equal(r.surrenderRate, 20)
})

test('computeAbandonRates all zero counts', () => {
  const r = computeAbandonRates(1000, 0, 0, 0)
  assert.equal(r.remakeRate, 0)
  assert.equal(r.earlySurrenderRate, 0)
  assert.equal(r.surrenderRate, 0)
})
