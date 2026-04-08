import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __testOnly } from './StatsBalanceService.js'

test('patch compare and normalization', () => {
  assert.equal(__testOnly.patchLabel('16.8.1'), '16.8')
  assert.equal(__testOnly.patchLabel('16.10'), '16.10')
  assert.ok(__testOnly.comparePatch('16.10', '16.9') > 0)
})

test('delta label smoke', () => {
  assert.equal(__testOnly.deltaLabel('BALANCED', 'BALANCED'), null)
  assert.equal(__testOnly.deltaLabel('OVERPOWERED', 'BALANCED'), 'BALANCED -> OVERPOWERED')
})

test('global status aggregation', () => {
  assert.equal(
    __testOnly.computeGlobalStatus({
      average: 'OVERPOWERED',
      skilled: 'BALANCED',
      elite: 'BALANCED',
    }),
    'OVERPOWERED'
  )
  assert.equal(
    __testOnly.computeGlobalStatus({
      average: 'UNDERPOWERED',
      skilled: 'UNDERPOWERED',
      elite: 'UNDERPOWERED',
    }),
    'UNDERPOWERED'
  )
  assert.equal(
    __testOnly.computeGlobalStatus({
      average: 'BALANCED',
      skilled: 'UNDERPOWERED',
      elite: 'BALANCED',
    }),
    'BALANCED'
  )
})
