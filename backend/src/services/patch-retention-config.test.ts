import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { getPollerPatchRetentionConfig } from './RiotConfigService.js'

const ENV_KEY = 'POLLER_PATCH_RETENTION_DAYS'

afterEach(() => {
  delete process.env[ENV_KEY]
})

test('getPollerPatchRetentionConfig: disabled by default', () => {
  delete process.env[ENV_KEY]
  assert.deepEqual(getPollerPatchRetentionConfig(), { enabled: false })
})

test('getPollerPatchRetentionConfig: false and 0 disable purge', () => {
  process.env[ENV_KEY] = 'false'
  assert.deepEqual(getPollerPatchRetentionConfig(), { enabled: false })
  process.env[ENV_KEY] = '0'
  assert.deepEqual(getPollerPatchRetentionConfig(), { enabled: false })
})

test('getPollerPatchRetentionConfig: true uses 5 days', () => {
  process.env[ENV_KEY] = 'true'
  assert.deepEqual(getPollerPatchRetentionConfig(), { enabled: true, days: 5 })
})

test('getPollerPatchRetentionConfig: positive integer sets retention days', () => {
  process.env[ENV_KEY] = '14'
  assert.deepEqual(getPollerPatchRetentionConfig(), { enabled: true, days: 14 })
})

test('getPollerPatchRetentionConfig: caps at 90 days', () => {
  process.env[ENV_KEY] = '120'
  assert.deepEqual(getPollerPatchRetentionConfig(), { enabled: true, days: 90 })
})
