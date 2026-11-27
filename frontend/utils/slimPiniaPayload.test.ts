import { describe, expect, it } from 'vitest'
import { SLIM_STORES, readSlimMarker, slimPiniaPayload } from './slimPiniaPayload'

describe('slimPiniaPayload (catalogues hors HTML SSR)', () => {
  const state = {
    items: { items: [{ id: '1001' }], status: 'success', error: null },
    champions: {
      champions: [{ id: 'Ahri' }],
      status: 'success',
      error: null,
      loadedLanguage: 'fr_FR',
    },
    runes: { runePaths: [{ id: 8000 }], status: 'success', error: null },
    version: { currentVersion: '16.23.1' },
  }

  it('vide items / champions / runes, garde le reste, liste les stores à recharger', () => {
    const { state: slim, stripped } = slimPiniaPayload(state)
    expect(stripped).toEqual(['items', 'champions', 'runes'])
    expect(slim.items).toEqual({ items: [], status: 'idle', error: null })
    expect(slim.champions).toEqual({
      champions: [],
      status: 'idle',
      error: null,
      loadedLanguage: null,
    })
    expect(slim.runes).toEqual({ runePaths: [], status: 'idle', error: null })
    expect(slim.version).toBe(state.version)
  })

  it('ne modifie pas l’état vivant du serveur', () => {
    slimPiniaPayload(state)
    expect(state.items.items).toHaveLength(1)
    expect(state.champions.loadedLanguage).toBe('fr_FR')
  })

  it('store vide ou absent → rien à recharger', () => {
    const { stripped } = slimPiniaPayload({ items: { items: [], status: 'idle' } })
    expect(stripped).toEqual([])
    expect(SLIM_STORES.map(s => s.id)).toEqual(['items', 'champions', 'runes'])
  })
})

describe('readSlimMarker (payload → stores à recharger côté client)', () => {
  it('valide la marque posée par le serveur', () => {
    expect(readSlimMarker({ lang: 'en_US', stores: ['items', 'runes'] })).toEqual({
      lang: 'en_US',
      stores: ['items', 'runes'],
    })
  })

  it('marque absente ou invalide → null ; ids inconnus ignorés', () => {
    expect(readSlimMarker(undefined)).toBeNull()
    expect(readSlimMarker({ lang: 3, stores: [] })).toBeNull()
    expect(readSlimMarker({ lang: 'fr_FR', stores: ['items', 'evil'] })).toEqual({
      lang: 'fr_FR',
      stores: ['items'],
    })
  })
})
