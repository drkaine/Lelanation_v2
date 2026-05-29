import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProgressionOldestOnlySql,
  buildProgressionSinceSql,
  comparePatchMajorMinor,
  progressionHasComparableSinceRange,
} from './statsPatchQuery.js'

test('comparePatchMajorMinor orders major.minor patches', () => {
  assert.ok(comparePatchMajorMinor('16.10', '16.11') < 0)
  assert.ok(comparePatchMajorMinor('16.11', '16.10') > 0)
  assert.equal(comparePatchMajorMinor('16.11', '16.11'), 0)
})

test('buildProgressionOldestOnlySql matches single patch only', () => {
  const sql = buildProgressionOldestOnlySql('ac', '16.11')
  assert.match(sql, /ac\.game_version = '16\.11'/)
  assert.match(sql, /ac\.game_version LIKE '16\.11\.%'/)
  assert.doesNotMatch(sql, /16\.10/)
})

test('buildProgressionSinceSql cumulative from ref without cap', () => {
  const sql = buildProgressionSinceSql('ac', '16.11', null, [
    '16.10.1',
    '16.11.1',
    '16.12.1',
  ])
  assert.doesNotMatch(sql, /16\.10/)
  assert.match(sql, /16\.11/)
  assert.match(sql, /16\.12/)
})

test('buildProgressionSinceSql cumulative from ref with cap', () => {
  const sql = buildProgressionSinceSql('ac', '16.10', '16.11', [
    '16.9.1',
    '16.10.1',
    '16.11.1',
    '16.12.1',
  ])
  assert.doesNotMatch(sql, /16\.9/)
  assert.match(sql, /16\.10/)
  assert.match(sql, /16\.11/)
  assert.doesNotMatch(sql, /16\.12/)
})

test('buildProgressionSinceSql returns FALSE when no patches in range', () => {
  const sql = buildProgressionSinceSql('ac', '16.11', null, ['16.10.1'])
  assert.equal(sql, 'FALSE')
})

test('progressionHasComparableSinceRange requires a patch newer than ref', () => {
  assert.equal(
    progressionHasComparableSinceRange('16.11', '16.11', ['16.11.1']),
    false,
  )
  assert.equal(
    progressionHasComparableSinceRange('16.11', '16.12', ['16.11.1', '16.12.1']),
    true,
  )
  assert.equal(
    progressionHasComparableSinceRange('16.11', null, ['16.11.1', '16.12.1']),
    true,
  )
})
