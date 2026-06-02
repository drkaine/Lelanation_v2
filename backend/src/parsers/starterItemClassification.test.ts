import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isStarterItemId,
  isStarterPurchase,
  STARTER_PURCHASE_WINDOW_MS,
} from './starterItemClassification.js'

test('treats Doran items as starters', () => {
  assert.equal(isStarterItemId(1055), true)
  assert.equal(isStarterItemId(1056), true)
})

test('does not treat legendaries as starters even when bought early', () => {
  assert.equal(isStarterItemId(3031), false)
  assert.equal(isStarterPurchase(60_000, 3031), false)
})

test('requires both time window and starter item id', () => {
  assert.equal(isStarterPurchase(STARTER_PURCHASE_WINDOW_MS - 1, 1055), true)
  assert.equal(isStarterPurchase(STARTER_PURCHASE_WINDOW_MS, 1055), false)
  assert.equal(isStarterPurchase(60_000, 3031), false)
})
