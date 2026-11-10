import { describe, expect, it } from 'vitest'
import { overviewItemSetItems } from '../../../../src/services/overviewItemSets.js'

describe('overviewItemSetItems', () => {
  it('garde les bottes et retire trinkets et potions', () => {
    expect(overviewItemSetItems('[3340,3006,3031,2055,6672]')).toEqual([3006, 3031, 6672])
  })
})
