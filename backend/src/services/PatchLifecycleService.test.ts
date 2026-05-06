import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trackedMatchesCutoffDateFromReleaseDate } from './PatchLifecycleService.js'

test('trackedMatchesCutoffDateFromReleaseDate: UTC start-of-day for valid YYYY-MM-DD', () => {
  const cutoff = trackedMatchesCutoffDateFromReleaseDate('2026-04-28')
  assert.ok(cutoff instanceof Date)
  assert.equal(cutoff!.toISOString(), '2026-04-28T00:00:00.000Z')
})

test('trackedMatchesCutoffDateFromReleaseDate: null for invalid or empty releaseDate', () => {
  assert.equal(trackedMatchesCutoffDateFromReleaseDate(''), null)
  assert.equal(trackedMatchesCutoffDateFromReleaseDate('2026/04/28'), null)
  assert.equal(trackedMatchesCutoffDateFromReleaseDate('not-a-date'), null)
})
