import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  comparePatchVersions,
  gameVersionToPatchNotesVersion,
  normalizeSlug,
} from './patchVersion.js'

test('gameVersionToPatchNotesVersion: converts ddragon to riot patch slug', () => {
  assert.equal(gameVersionToPatchNotesVersion('16.11.1'), '26.11')
  assert.equal(gameVersionToPatchNotesVersion('16.4'), '26.4')
  assert.equal(gameVersionToPatchNotesVersion(''), null)
})

test('comparePatchVersions: orders major.minor correctly', () => {
  assert.ok(comparePatchVersions('26.11', '26.12') < 0)
  assert.equal(comparePatchVersions('26.12', '26.12'), 0)
  assert.ok(comparePatchVersions('27.1', '26.12') > 0)
})

test('normalizeSlug: strips accents and special chars', () => {
  assert.equal(normalizeSlug('Force de la Trinité'), 'force-de-la-trinite')
  assert.equal(normalizeSlug('Trinity Force'), 'trinity-force')
})
