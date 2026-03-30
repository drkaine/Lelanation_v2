import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatUnifiedLogLine,
  parseUnifiedLogLine,
} from './unifiedAppLog.js'

test('format and parse round-trip', () => {
  const line = formatUnifiedLogLine({
    section: 'back',
    type: 'fin',
    script: 'poller',
    message: 'cycle done',
    json: { matches: 8 },
    at: new Date('2026-03-30T12:00:00.000Z'),
  })
  const p = parseUnifiedLogLine(line, 1)
  assert.ok(p)
  assert.equal(p!.section, 'back')
  assert.equal(p!.type, 'fin')
  assert.equal(p!.script, 'poller')
  assert.equal(p!.atIso, '2026-03-30T12:00:00.000Z')
  assert.equal(p!.message, 'cycle done')
  assert.deepEqual(p!.json, { matches: 8 })
})

test('parse line without json', () => {
  const line =
    '[db] [erreur] [mv_refresh]\t2026-01-01T00:00:00.000Z\tsomething failed\t'
  const p = parseUnifiedLogLine(line, 2)
  assert.ok(p)
  assert.equal(p!.json, null)
})
