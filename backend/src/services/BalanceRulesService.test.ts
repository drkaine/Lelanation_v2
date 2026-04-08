import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getDefaultBalanceRules, sanitizeBalanceRules } from './BalanceRulesService.js'

test('sanitizeBalanceRules keeps defaults for invalid payload', () => {
  const out = sanitizeBalanceRules({})
  const def = getDefaultBalanceRules()
  assert.deepEqual(out, def)
})

test('sanitizeBalanceRules clamps values and keeps tier fallback', () => {
  const out = sanitizeBalanceRules({
    levels: {
      average: {
        tiers: [],
        overpowered: {
          winrateHigh: 999,
          winrateLow: -5,
          banrateMultiplier: -1,
          minGames: 0,
        },
      },
      elite: {
        overpowered: { banrateTwoPatchAvgMin: 101 },
        underpowered: { presenceMax: -2 },
      },
    },
  })
  assert.equal(out.levels.average.overpowered.winrateHigh, 100)
  assert.equal(out.levels.average.overpowered.winrateLow, 0)
  assert.equal(out.levels.average.overpowered.banrateMultiplier, 0)
  assert.equal(out.levels.average.overpowered.minGames, 1)
  assert.ok(out.levels.average.tiers.length > 0)
  assert.equal(out.levels.elite.overpowered.banrateTwoPatchAvgMin, 100)
  assert.equal(out.levels.elite.underpowered.presenceMax, 0)
})
