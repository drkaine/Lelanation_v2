import { describe, expect, it } from 'vitest'
import { publicFetchCache } from './publicFetchCache'

describe('publicFetchCache (JSON statiques)', () => {
  it('URL versionnée par patch → cache navigateur (immutable côté serveur)', () => {
    expect(publicFetchCache('/data/game/16.23.1/fr_FR/item.json')).toBe('default')
    expect(publicFetchCache('/data/game/16.23.1/en_US/champions/ksante.json?_v=16_23_1')).toBe(
      'default'
    )
  })

  it('URL non versionnée → revalidation', () => {
    expect(publicFetchCache('/data/game/version.json')).toBe('no-cache')
    expect(publicFetchCache('/data/game/versions.json')).toBe('no-cache')
    expect(publicFetchCache('/data/patch-notes/16.23/patch-16.23-fr-FR.json')).toBe('no-cache')
  })
})
