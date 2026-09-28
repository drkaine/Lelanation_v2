import { describe, expect, it } from 'vitest'
import { sqlLiteral } from '../../../../src/stats/sqlLiteral.js'

describe('sqlLiteral', () => {
  it('doubles single quotes', () => {
    expect(sqlLiteral("O'Brien's")).toBe("O''Brien''s")
    expect(sqlLiteral('GOLD')).toBe('GOLD')
  })
})
