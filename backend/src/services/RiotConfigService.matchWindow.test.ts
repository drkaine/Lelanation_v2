import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeMatchIdsTimeWindow,
  releaseDateToStartOfDayUtcSeconds,
  comparePatchLabelsAsc,
  isWithinPatchRolloutGraceUtc,
  findPreviousPatchEntry,
  resolveLatestPatchPriorityWindow,
  patchRetentionCutoffDateIso,
} from './RiotConfigService.js'
import type { MatchFiltersConfig, GameVersionsRecap } from './RiotConfigService.js'

test('releaseDateToStartOfDayUtcSeconds UTC midnight', () => {
  const s = releaseDateToStartOfDayUtcSeconds('2026-02-19')
  assert.equal(s, Math.floor(Date.UTC(2026, 1, 19, 0, 0, 0, 0) / 1000))
})

test('comparePatchLabelsAsc', () => {
  assert.ok(comparePatchLabelsAsc('16.1', '16.2') < 0)
  assert.ok(comparePatchLabelsAsc('16.2', '16.1') > 0)
  assert.equal(comparePatchLabelsAsc('16.4', '16.4'), 0)
})

test('computeMatchIdsTimeWindow: min start, next patch end', () => {
  const filters: MatchFiltersConfig = {
    queue: 420,
    count: 100,
    versions: [
      { version: '16.4', start: 0, maxMatches: 100, completed: false },
      { version: '16.5', start: 0, maxMatches: 100, completed: false },
    ],
  }
  const recap: GameVersionsRecap = {
    versions: [
      { version: '16.5.1', releaseDate: '2026-03-04', patchLabel: '16.5' },
      { version: '16.4.1', releaseDate: '2026-02-19', patchLabel: '16.4' },
      { version: '16.6.1', releaseDate: '2026-03-17', patchLabel: '16.6' },
    ],
  }
  const w = computeMatchIdsTimeWindow(filters, recap)
  assert.ok(w)
  assert.equal(w!.startTime, releaseDateToStartOfDayUtcSeconds('2026-02-19'))
  assert.equal(w!.endTime, releaseDateToStartOfDayUtcSeconds('2026-03-17'))
})

test('isWithinPatchRolloutGraceUtc: day 0 and within graceDays', () => {
  const rel = '2026-03-31'
  const start = releaseDateToStartOfDayUtcSeconds(rel)
  assert.ok(isWithinPatchRolloutGraceUtc(rel, 2, start))
  assert.ok(isWithinPatchRolloutGraceUtc(rel, 2, start + 86400))
  assert.ok(isWithinPatchRolloutGraceUtc(rel, 2, start + 2 * 86400))
  assert.ok(!isWithinPatchRolloutGraceUtc(rel, 2, start + 3 * 86400))
  assert.ok(!isWithinPatchRolloutGraceUtc(rel, 2, start - 1))
})

test('findPreviousPatchEntry', () => {
  const recap: GameVersionsRecap = {
    versions: [
      { version: '16.7.1', releaseDate: '2026-03-31', patchLabel: '16.7' },
      { version: '16.6.1', releaseDate: '2026-03-17', patchLabel: '16.6' },
    ],
  }
  const p = findPreviousPatchEntry(recap, '16.7')
  assert.ok(p)
  assert.equal(p!.patchLabel, '16.6')
})

test('resolveLatestPatchPriorityWindow: grace includes previous patch and earlier startTime', () => {
  const recap: GameVersionsRecap = {
    versions: [
      { version: '16.7.1', releaseDate: '2026-03-31', patchLabel: '16.7' },
      { version: '16.6.1', releaseDate: '2026-03-17', patchLabel: '16.6' },
    ],
  }
  const relStart = releaseDateToStartOfDayUtcSeconds('2026-03-31')
  const nowSec = relStart + 86400
  const w = resolveLatestPatchPriorityWindow({
    latestPatch: '16.7',
    currentReleaseDate: '2026-03-31',
    recap,
    graceDays: 2,
    nowSec,
  })
  assert.deepEqual(w.allowedPatches, ['16.7', '16.6'])
  assert.equal(w.matchListStartTime, releaseDateToStartOfDayUtcSeconds('2026-03-17'))
})

test('resolveLatestPatchPriorityWindow: after grace, latest only', () => {
  const recap: GameVersionsRecap = {
    versions: [
      { version: '16.7.1', releaseDate: '2026-03-31', patchLabel: '16.7' },
      { version: '16.6.1', releaseDate: '2026-03-17', patchLabel: '16.6' },
    ],
  }
  const relStart = releaseDateToStartOfDayUtcSeconds('2026-03-31')
  const nowSec = relStart + 4 * 86400
  const w = resolveLatestPatchPriorityWindow({
    latestPatch: '16.7',
    currentReleaseDate: '2026-03-31',
    recap,
    graceDays: 2,
    nowSec,
  })
  assert.deepEqual(w.allowedPatches, ['16.7'])
  assert.equal(w.matchListStartTime, relStart)
})

test('patchRetentionCutoffDateIso: release minus retention days', () => {
  assert.equal(patchRetentionCutoffDateIso('2026-03-31', 5), '2026-03-26')
  assert.equal(patchRetentionCutoffDateIso('2026-02-19', 5), '2026-02-14')
  assert.equal(patchRetentionCutoffDateIso('invalid', 5), null)
})
