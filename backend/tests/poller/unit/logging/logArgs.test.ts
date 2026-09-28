import { describe, expect, it } from 'vitest'
import { formatLogArgs, logArgsJson } from '../../../../src/logging/logArgs.js'

describe('formatLogArgs', () => {
  it('appends extra args, objects as JSON', () => {
    expect(formatLogArgs('sync done', [])).toBe('sync done')
    expect(formatLogArgs('sync done', [3, { ok: true }])).toBe('sync done 3 {"ok":true}')
  })
})

describe('logArgsJson', () => {
  it('keeps a single plain object, wraps anything else in details', () => {
    expect(logArgsJson([])).toBeNull()
    expect(logArgsJson([{ a: 1 }])).toEqual({ a: 1 })
    expect(logArgsJson([[1], 'x'])).toEqual({ details: ['[1]', 'x'] })
  })
})
