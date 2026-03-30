import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeMatchIdsTimeWindow,
  releaseDateToStartOfDayUtcSeconds,
  comparePatchLabelsAsc,
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
