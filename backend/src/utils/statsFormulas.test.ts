import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  winratePercent,
  winratePercentRounded,
  pickratePercent,
  banratePercent,
  ratePercent,
  pbi,
  tierScore,
  presencePercent,
} from './statsFormulas.js'

test('winratePercent', () => {
  assert.equal(winratePercent(0, 10), 0)
  assert.equal(winratePercent(5, 10), 50)
  assert.equal(winratePercent(3, 10), 30)
  assert.equal(winratePercent(7, 10), 70)
  assert.equal(winratePercent(0, 0), 0)
  assert.equal(winratePercent(10, 0), 0)
})

test('winratePercentRounded', () => {
  assert.equal(winratePercentRounded(1, 3), 33.3)
  assert.equal(winratePercentRounded(2, 3), 66.7)
  assert.equal(winratePercentRounded(52, 100), 52)
  assert.equal(winratePercentRounded(33, 100), 33)
  assert.equal(winratePercentRounded(0, 0), 0)
})

test('pickratePercent', () => {
  assert.equal(pickratePercent(100, 1000), 10)
  assert.equal(pickratePercent(0, 1000), 0)
  assert.equal(pickratePercent(500, 1000), 50)
  assert.equal(pickratePercent(100, 0), 0)
})

test('banratePercent', () => {
  assert.equal(banratePercent(50, 1000), 5)
  assert.equal(banratePercent(200, 1000), 20)
  assert.equal(banratePercent(0, 1000), 0)
  assert.equal(banratePercent(50, 0), 0)
})

test('ratePercent (abandon rates)', () => {
  assert.equal(ratePercent(10, 100), 10)
  assert.equal(ratePercent(25, 100), 25)
  assert.equal(ratePercent(0, 100), 0)
  assert.ok(Math.abs(ratePercent(1, 3) - 100 / 3) < 1e-9)
  assert.equal(ratePercent(0, 0), 0)
})

test('pbi', () => {
  // (55 - 50) * 10 / (100 - 20) = 5 * 10 / 80 = 0.625
  assert.ok(Math.abs(pbi(55, 10, 20) - 0.625) < 1e-9)
  // banrate 100 → denom 0 → 0
  assert.equal(pbi(55, 10, 100), 0)
  assert.equal(pbi(50, 10, 20), 0)
  // negative PBI when winrate < 50
  assert.ok(pbi(45, 10, 20) < 0)
})

test('tierScore', () => {
  // winrate 0.5 → score 0
  assert.equal(tierScore(0.5, 100), 0)
  // winrate 0.6, 100 games → 0.1 * 10 = 1
  assert.ok(Math.abs(tierScore(0.6, 100) - 1) < 1e-9)
  // winrate 0.4, 100 games → -0.1 * 10 = -1
  assert.ok(Math.abs(tierScore(0.4, 100) - (-1)) < 1e-9)
  assert.equal(tierScore(0.5, 0), 0)
})

test('presencePercent', () => {
  // games 80 + ban 20 = 100, total 1000 → 10%
  assert.equal(presencePercent(80, 20, 1000), 10)
  assert.equal(presencePercent(0, 0, 1000), 0)
  assert.equal(presencePercent(100, 0, 0), 0)
})
