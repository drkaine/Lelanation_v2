import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildGameOrderItemsJson,
  buildOrderItemsMergeSqlExpr,
  uniquePurchaseOrderPositions,
} from './purchaseOrderItemsJson.js'

test('buildGameOrderItemsJson assigns games/wins per position', () => {
  const json = buildGameOrderItemsJson([1, 2, 3], 1)
  assert.deepEqual(json, {
    '1': { games: 1, wins: 1 },
    '2': { games: 1, wins: 1 },
    '3': { games: 1, wins: 1 },
  })
})

test('uniquePurchaseOrderPositions deduplicates and sorts', () => {
  const map = new Map<number, number>([
    [3031, 3],
    [1055, 1],
    [3078, 3],
  ])
  assert.deepEqual(uniquePurchaseOrderPositions(map), [1, 3])
})

test('buildOrderItemsMergeSqlExpr nests jsonb_set per position', () => {
  const sql = buildOrderItemsMergeSqlExpr('champion_vs_stats.order_items', [1, 2], 1)
  assert.match(sql, /jsonb_set/)
  assert.match(sql, /ARRAY\['1'\]/)
  assert.match(sql, /ARRAY\['2'\]/)
})
