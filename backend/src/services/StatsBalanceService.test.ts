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

test('collapse to main role per champion', () => {
  const rows = [
    {
      championId: 1,
      role: 'TOP',
      average: { games: 10, winrate: 50, pickrate: 2, banrate: 1, presence: 3, status: 'BALANCED' as const, previousStatus: null, delta: null },
      skilled: { games: 10, winrate: 50, pickrate: 2, banrate: 1, presence: 3, status: 'BALANCED' as const, previousStatus: null, delta: null },
      elite: { games: 10, winrate: 50, pickrate: 2, banrate: 1, presence: 3, status: 'BALANCED' as const, previousStatus: null, delta: null },
      globalStatus: 'BALANCED' as const,
      previousGlobalStatus: null,
      globalDelta: null,
    },
    {
      championId: 1,
      role: 'JUNGLE',
      average: { games: 80, winrate: 50, pickrate: 5, banrate: 1, presence: 6, status: 'BALANCED' as const, previousStatus: null, delta: null },
      skilled: { games: 80, winrate: 50, pickrate: 5, banrate: 1, presence: 6, status: 'BALANCED' as const, previousStatus: null, delta: null },
      elite: { games: 80, winrate: 50, pickrate: 5, banrate: 1, presence: 6, status: 'BALANCED' as const, previousStatus: null, delta: null },
      globalStatus: 'BALANCED' as const,
      previousGlobalStatus: null,
      globalDelta: null,
    },
    {
      championId: 2,
      role: 'MIDDLE',
      average: { games: 50, winrate: 50, pickrate: 3, banrate: 1, presence: 4, status: 'BALANCED' as const, previousStatus: null, delta: null },
      skilled: { games: 50, winrate: 50, pickrate: 3, banrate: 1, presence: 4, status: 'BALANCED' as const, previousStatus: null, delta: null },
      elite: { games: 50, winrate: 50, pickrate: 3, banrate: 1, presence: 4, status: 'BALANCED' as const, previousStatus: null, delta: null },
      globalStatus: 'BALANCED' as const,
      previousGlobalStatus: null,
      globalDelta: null,
    },
  ]
  const collapsed = __testOnly.collapseBalanceRowsToMainRole(rows)
  assert.equal(collapsed.length, 2)
  const ahri = collapsed.find(r => r.championId === 1)
  assert.equal(ahri?.role, 'JUNGLE')
})

test('normalizeRoleFilter maps UI roles to champion and banner SQL', () => {
  assert.deepEqual(__testOnly.normalizeRoleFilter('MIDDLE'), {
    client: 'MIDDLE',
    championSql: 'MID',
    bannerSql: 'MIDDLE',
  })
  assert.deepEqual(__testOnly.normalizeRoleFilter('BOTTOM'), {
    client: 'BOTTOM',
    championSql: 'ADC',
    bannerSql: 'BOTTOM',
  })
  assert.deepEqual(__testOnly.normalizeRoleFilter('MID'), {
    client: 'MIDDLE',
    championSql: 'MID',
    bannerSql: 'MIDDLE',
  })
  assert.deepEqual(__testOnly.normalizeRoleFilter('ADC'), {
    client: 'BOTTOM',
    championSql: 'ADC',
    bannerSql: 'BOTTOM',
  })
  assert.equal(__testOnly.normalizeRoleFilter('TOP')?.championSql, 'TOP')
  assert.equal(__testOnly.normalizeRoleFilter(''), null)
})

test('balance role keys unify MID/ADC rows with MIDDLE/BOTTOM bans', () => {
  assert.equal(__testOnly.balanceRoleKeyFromChampionColumn('MID'), 'MIDDLE')
  assert.equal(__testOnly.balanceRoleKeyFromChampionColumn('ADC'), 'BOTTOM')
  assert.equal(__testOnly.balanceRoleKeyFromBannerColumn('MIDDLE'), 'MIDDLE')
  assert.equal(__testOnly.balanceRoleKeyFromBannerColumn('BOTTOM'), 'BOTTOM')
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
