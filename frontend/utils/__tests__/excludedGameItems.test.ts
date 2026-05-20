import { describe, expect, it } from 'vitest'
import { isExcludedGameItemId } from '../excludedGameItems'

describe('excludedGameItems', () => {
  it("excludes Anathema's Chains", () => {
    expect(isExcludedGameItemId('8001')).toBe(true)
    expect(isExcludedGameItemId('228001')).toBe(true)
  })

  it('allows normal legendary items', () => {
    expect(isExcludedGameItemId('3089')).toBe(false)
  })
})
