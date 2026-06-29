import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DISK_EMERGENCY_CLEANUP_THRESHOLD,
  rankHistoryCutoffDateForAgeHours,
  shouldRunDiskEmergencyCleanup,
} from './diskSpaceEmergencyCleanup.js'

test('shouldRunDiskEmergencyCleanup triggers from 95% once per threshold step', () => {
  assert.equal(
    shouldRunDiskEmergencyCleanup({
      usagePercent: 96,
      alertThreshold: 95,
      lastCleanupAtThreshold: 0,
    }),
    true
  )

  assert.equal(
    shouldRunDiskEmergencyCleanup({
      usagePercent: 96,
      alertThreshold: 95,
      lastCleanupAtThreshold: 95,
    }),
    false
  )

  assert.equal(
    shouldRunDiskEmergencyCleanup({
      usagePercent: 94,
      alertThreshold: 90,
      lastCleanupAtThreshold: 0,
    }),
    false
  )
})

test('shouldRunDiskEmergencyCleanup runs again when crossing 100%', () => {
  assert.equal(
    shouldRunDiskEmergencyCleanup({
      usagePercent: 99,
      alertThreshold: 95,
      lastCleanupAtThreshold: 95,
    }),
    false
  )

  assert.equal(
    shouldRunDiskEmergencyCleanup({
      usagePercent: 99.5,
      alertThreshold: 95,
      lastCleanupAtThreshold: 95,
    }),
    false
  )
})

test('rankHistoryCutoffDateForAgeHours uses 24h window', () => {
  const now = Date.parse('2026-06-27T15:00:00.000Z')
  assert.equal(
    rankHistoryCutoffDateForAgeHours(24, now),
    '2026-06-26'
  )
})

test('DISK_EMERGENCY_CLEANUP_THRESHOLD is 95', () => {
  assert.equal(DISK_EMERGENCY_CLEANUP_THRESHOLD, 95)
})
