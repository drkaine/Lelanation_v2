import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ParsedItemDto } from '../dto/match.dto.js'
import { getItemMetaLiteMap } from './itemMetaLite.js'
import {
  buildStarterLegendaryOrderByItemId,
  isComponentItemId,
  isItemOrderSnapshotEligible,
} from './itemOrderSnapshot.js'

test('order positions follow first purchase among starters', () => {
  const items: ParsedItemDto[] = [
    { itemId: 1055, phase: 'starter', timestampMs: 120_000, win: true },
    { itemId: 1056, phase: 'starter', timestampMs: 60_000, win: true },
  ]
  const order = buildStarterLegendaryOrderByItemId(items)
  assert.equal(order.get(1056), 1)
  assert.equal(order.get(1055), 2)
})

test('excludes components (items with into) when metadata is available', () => {
  const meta = getItemMetaLiteMap()
  if (meta.size === 0) return

  const component = [...meta.entries()].find(
    ([, it]) =>
      Array.isArray(it.from) &&
      it.from.length > 0 &&
      Array.isArray(it.into) &&
      it.into.length > 0,
  )
  assert.ok(component, 'expected at least one component item in item.json')
  const [compId] = component!

  assert.equal(isComponentItemId(compId), true)
  const items: ParsedItemDto[] = [
    { itemId: 1055, phase: 'starter', timestampMs: 60_000, win: true },
    { itemId: compId, phase: 'core', timestampMs: 600_000, win: true },
  ]
  const order = buildStarterLegendaryOrderByItemId(items)
  assert.equal(order.has(compId), false)
  assert.equal(order.has(1055), true)
})

test('starter window only for starter flag', () => {
  assert.equal(isItemOrderSnapshotEligible(1055, 60_000), true)
  assert.equal(isItemOrderSnapshotEligible(1055, 400_000), false)
})
