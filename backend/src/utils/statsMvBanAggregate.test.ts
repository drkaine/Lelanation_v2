import test from 'node:test'
import assert from 'node:assert/strict'
import { bansPerChampionFromMvRows } from './statsMvBanAggregate.js'

test('bansPerChampionFromMvRows: one ban count per MV slice (duplicate role rows)', () => {
  const rows = [
    { championId: 1, rankTier: 'GOLD', gameVersion: '15.1', region: 'EUW', countBan: 100 },
    { championId: 1, rankTier: 'GOLD', gameVersion: '15.1', region: 'EUW', countBan: 100 },
    { championId: 1, rankTier: 'GOLD', gameVersion: '15.1', region: 'EUW', countBan: 100 },
  ]
  assert.equal(bansPerChampionFromMvRows(rows).get(1), 100)
})

test('bansPerChampionFromMvRows: sum across regions', () => {
  const rows = [
    { championId: 1, rankTier: 'GOLD', gameVersion: '15.1', region: 'EUW', countBan: 40 },
    { championId: 1, rankTier: 'GOLD', gameVersion: '15.1', region: 'NA', countBan: 60 },
  ]
  assert.equal(bansPerChampionFromMvRows(rows).get(1), 100)
})
