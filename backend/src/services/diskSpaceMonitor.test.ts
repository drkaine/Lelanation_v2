import test from 'node:test'
import assert from 'node:assert/strict'
import {
  diskAlertThresholdForUsage,
  evaluateDiskAlert,
} from './diskSpaceMonitor.js'

test('diskAlertThresholdForUsage returns null below 70%', () => {
  assert.equal(diskAlertThresholdForUsage(69.9), null)
  assert.equal(diskAlertThresholdForUsage(0), null)
})

test('diskAlertThresholdForUsage steps every 5% from 70%', () => {
  assert.equal(diskAlertThresholdForUsage(70), 70)
  assert.equal(diskAlertThresholdForUsage(74.9), 70)
  assert.equal(diskAlertThresholdForUsage(75), 75)
  assert.equal(diskAlertThresholdForUsage(82.3), 80)
  assert.equal(diskAlertThresholdForUsage(95), 95)
  assert.equal(diskAlertThresholdForUsage(99.9), 95)
})

test('evaluateDiskAlert alerts once per crossed threshold', () => {
  assert.deepEqual(evaluateDiskAlert(82, 0), {
    alertThreshold: 80,
    shouldAlert: true,
    previousThreshold: 0,
  })

  assert.deepEqual(evaluateDiskAlert(82, 80), {
    alertThreshold: 80,
    shouldAlert: false,
    previousThreshold: 80,
  })

  assert.deepEqual(evaluateDiskAlert(86, 80), {
    alertThreshold: 85,
    shouldAlert: true,
    previousThreshold: 80,
  })
})

test('evaluateDiskAlert resets when usage drops below 70%', () => {
  assert.deepEqual(evaluateDiskAlert(65, 85), {
    alertThreshold: null,
    shouldAlert: false,
    previousThreshold: 85,
  })
})
