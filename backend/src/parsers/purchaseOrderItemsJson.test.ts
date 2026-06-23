import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildGameOrderItemsJson,
  buildOrderItemsMergeSqlExpr,
  orderedEligibleItemIds,
} from './purchaseOrderItemsJson.js'

test('buildGameOrderItemsJson assigns games/wins per item id', () => {
  const json = buildGameOrderItemsJson([1055, 3031, 3078], 1)
  assert.deepEqual(json, {
    '1055': { games: 1, wins: 1 },
    '3031': { games: 1, wins: 1 },
    '3078': { games: 1, wins: 1 },
  })
})

test('orderedEligibleItemIds sorts by purchase order position', () => {
  const map = new Map<number, number>([
    [3031, 3],
    [1055, 1],
    [3078, 3],
  ])
  assert.deepEqual(orderedEligibleItemIds(map), [1055, 3031, 3078])
})

test('buildOrderItemsMergeSqlExpr nests jsonb_set per item id', () => {
  const sql = buildOrderItemsMergeSqlExpr('champion_vs_stats.order_items', [1055, 3031], 1)
  assert.match(sql, /jsonb_set/)
  assert.match(sql, /ARRAY\['1055'\]/)
  assert.match(sql, /ARRAY\['3031'\]/)
})
