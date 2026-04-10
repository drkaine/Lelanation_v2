import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MV_NAMES, MV_REFRESH_GROUPS } from './MaterializedViewService.js'

test('MV_REFRESH_GROUPS partitions MV_NAMES exactly (no dup, no omission)', () => {
  const flat = MV_REFRESH_GROUPS.flat()
  assert.equal(flat.length, MV_NAMES.length)
  assert.equal(new Set(flat).size, flat.length, 'duplicate MV name in groups')
  const sortedFlat = [...flat].sort()
  const sortedNames = [...MV_NAMES].sort()
  assert.deepEqual(sortedFlat, sortedNames)
})
