import { describe, expect, it } from 'vitest'
import { balanceQuickMatch, countBalanceQuick } from '../balanceQuickFilter'

const op = { globalStatus: 'OVERPOWERED' as const, globalDelta: null }
const up = { globalStatus: 'UNDERPOWERED' as const, globalDelta: 'BALANCED>UNDERPOWERED' }
const ok = { globalStatus: 'BALANCED' as const, globalDelta: '' }

describe('balanceQuickMatch', () => {
  it('ALL keeps everything', () => {
    expect([op, up, ok].every(r => balanceQuickMatch(r, 'ALL'))).toBe(true)
  })
  it('NERF / BUFF follow the global status', () => {
    expect(balanceQuickMatch(op, 'NERF')).toBe(true)
    expect(balanceQuickMatch(up, 'NERF')).toBe(false)
    expect(balanceQuickMatch(up, 'BUFF')).toBe(true)
  })
  it('EQUAL keeps balanced rows', () => {
    expect(balanceQuickMatch(ok, 'EQUAL')).toBe(true)
    expect(balanceQuickMatch(op, 'EQUAL')).toBe(false)
  })
  it('CHANGED keeps rows with a global delta', () => {
    expect(balanceQuickMatch(up, 'CHANGED')).toBe(true)
    expect(balanceQuickMatch(op, 'CHANGED')).toBe(false)
    expect(balanceQuickMatch(ok, 'CHANGED')).toBe(false)
  })
})

describe('countBalanceQuick', () => {
  it('counts each quick filter', () => {
    expect(countBalanceQuick([op, up, ok])).toEqual({
      ALL: 3,
      NERF: 1,
      EQUAL: 1,
      BUFF: 1,
      CHANGED: 1,
    })
  })
})
