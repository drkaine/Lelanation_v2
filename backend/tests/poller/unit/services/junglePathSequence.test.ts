import { describe, expect, it } from 'vitest'
import { junglePathSequence } from '../../../../src/services/junglePathSequence.js'

describe('junglePathSequence', () => {
  it('reads the jsonb path sequence (parsed or raw text)', () => {
    expect(junglePathSequence(['blue', 'gromp', 'wolves'])).toEqual(['blue', 'gromp', 'wolves'])
    expect(junglePathSequence('["red","krugs"]')).toEqual(['red', 'krugs'])
  })

  it('is empty for anything else', () => {
    expect(junglePathSequence(null)).toEqual([])
    expect(junglePathSequence('not json')).toEqual([])
    expect(junglePathSequence({ path: [] })).toEqual([])
  })
})
