import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePersistedToggle } from './usePersistedToggle'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
})

describe('usePersistedToggle', () => {
  it('fermé par défaut', () => {
    const { open, restore } = usePersistedToggle('k')
    restore()
    expect(open.value).toBe(false)
  })

  it('retient le choix entre deux montages', () => {
    const first = usePersistedToggle('k')
    first.toggle()
    expect(first.open.value).toBe(true)
    const second = usePersistedToggle('k')
    expect(second.open.value).toBe(false)
    second.restore()
    expect(second.open.value).toBe(true)
    second.toggle()
    const third = usePersistedToggle('k')
    third.restore()
    expect(third.open.value).toBe(false)
  })

  it('reste fermé si le stockage est inaccessible', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const { open, toggle, restore } = usePersistedToggle('k')
    restore()
    expect(open.value).toBe(false)
    toggle()
    expect(open.value).toBe(true)
  })
})
