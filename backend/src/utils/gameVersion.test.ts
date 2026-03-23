import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gameVersionFromMatchInfo, normalizeGameVersionToMajorMinor } from './gameVersion.js'

test('normalizeGameVersionToMajorMinor trims Riot long client version', () => {
  assert.equal(normalizeGameVersionToMajorMinor('16.4.748.682'), '16.4')
  assert.equal(normalizeGameVersionToMajorMinor('  15.1.123.456  '), '15.1')
  assert.equal(normalizeGameVersionToMajorMinor('15.1'), '15.1')
})

test('gameVersionFromMatchInfo reads camelCase or snake_case', () => {
  assert.equal(gameVersionFromMatchInfo({ gameVersion: '16.4.999' }), '16.4.999')
  assert.equal(gameVersionFromMatchInfo({ game_version: '16.4.999' } as Record<string, unknown>), '16.4.999')
  assert.equal(gameVersionFromMatchInfo(null), null)
})
