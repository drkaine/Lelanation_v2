import { describe, expect, it } from 'vitest'
import { useToggleSet } from './useToggleSet'

describe('useToggleSet', () => {
  it('adds then removes a key, replacing the set so watchers fire', () => {
    const { set, toggle } = useToggleSet<string>()
    const first = set.value
    toggle('a')
    expect(set.value.has('a')).toBe(true)
    expect(set.value).not.toBe(first)
    toggle('a')
    expect(set.value.has('a')).toBe(false)
  })

  it('starts from initial keys and clears', () => {
    const { set, toggle, clear } = useToggleSet<number>([1, 2])
    toggle(3)
    expect([...set.value]).toEqual([1, 2, 3])
    clear()
    expect(set.value.size).toBe(0)
  })
})
