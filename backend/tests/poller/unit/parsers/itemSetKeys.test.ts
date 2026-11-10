import { describe, expect, it } from 'vitest'
import { itemSetKeysFromHistory } from '../../../../src/parsers/itemSetKeys.js'

const at = (itemId: number, timestampMs: number) => ({ itemId, timestampMs })

describe('itemSetKeysFromHistory', () => {
  // Doran (1055) + potion (2003) au départ, BF (1038) composant, bottes 1001 -> 3006,
  // légendaires IE (3031), Kraken (6672), PD (3046), LDR (3036) dans cet ordre.
  const history = [
    at(1055, 5_000),
    at(2003, 6_000),
    at(1001, 300_000),
    at(1038, 400_000),
    at(6672, 600_000),
    at(3006, 700_000),
    at(3031, 900_000),
    at(3046, 1_200_000),
    at(3036, 1_500_000),
  ]

  it('starter = achats de départ, sans potion', () => {
    expect(itemSetKeysFromHistory(history).starterKey).toBe('1055')
  })

  it('core = 3 premiers légendaires, sans composant ni bottes', () => {
    expect(itemSetKeysFromHistory(history).coreKey).toBe('3031_3046_6672')
  })

  it('final = starter + bottes T2/T3 + core, sans composant', () => {
    expect(itemSetKeysFromHistory(history).finalKey).toBe('1055_3006_3031_3046_6672')
  })

  it('historique vide -> clés vides', () => {
    expect(itemSetKeysFromHistory([])).toEqual({ starterKey: '', coreKey: '', bootsKey: '', finalKey: '' })
  })
})
