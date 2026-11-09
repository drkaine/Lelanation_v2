import { describe, expect, it } from 'vitest'
import {
  MISC_STAT_GROUPS,
  formatMiscGrowth,
  formatMiscValue,
  miscResourceCell,
} from '~/utils/statistics/miscStatCells'

describe('miscStatCells', () => {
  it('groupes de la maquette : survie, attaque, autres', () => {
    expect(MISC_STAT_GROUPS.map(g => g.key)).toEqual(['survival', 'attack', 'other'])
    expect(MISC_STAT_GROUPS[0]!.stats).toEqual(['hp', 'armor', 'magicResist'])
    expect(MISC_STAT_GROUPS[1]!.stats).toEqual(['attackDamage', 'attackSpeed', 'attackRange'])
    expect(MISC_STAT_GROUPS[2]!.stats).toEqual(['mp', 'movespeed'])
  })

  it('valeur au format de la locale', () => {
    expect(formatMiscValue('attackSpeed', 0.625, 'fr')).toBe('0,625')
    expect(formatMiscValue('armor', 32.5, 'fr')).toBe('32,5')
    expect(formatMiscValue('movespeed', 335.4, 'en')).toBe('335')
    expect(formatMiscValue('hp', 640, 'en')).toBe('640')
  })

  it('croissance : +x, % pour la vitesse, rien si nulle', () => {
    expect(formatMiscGrowth('armor', 5.2, 'fr')).toBe('+5,2')
    expect(formatMiscGrowth('attackSpeed', 3.5, 'fr')).toBe('+3,5\u00A0%')
    expect(formatMiscGrowth('attackSpeed', 3.5, 'en')).toBe('+3.5%')
    expect(formatMiscGrowth('hp', 0, 'fr')).toBeNull()
  })

  it('ressource : quantité + type, ou nom de la ressource', () => {
    const base = { mp: 350 } as never
    expect(miscResourceCell({ partype: 'Mana', base }, 350, 'fr')).toBe('350 mana')
    expect(miscResourceCell({ partype: 'Energy', base }, 200, 'en')).toBe('200 energy')
    expect(miscResourceCell({ partype: 'None', base }, 0, 'fr')).toBe('Aucune')
    expect(miscResourceCell({ partype: 'Courage', base }, 0, 'fr')).toBe('Courage')
    expect(miscResourceCell({ partype: 'Fury', base }, 100, 'en')).toBe('Fury')
  })
})

describe('miscStatMeta', () => {
  it('gives an icon and a colour for every base stat column', async () => {
    const { miscStatMeta, MISC_STAT_GROUPS: groups } =
      await import('~/utils/statistics/miscStatCells')
    for (const g of groups) {
      for (const key of g.stats) {
        const m = miscStatMeta(key)
        expect(m.icon).toMatch(/^\/icons\/statsicon\//)
        expect(m.color).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
    expect(miscStatMeta('hp').icon).toBe('/icons/statsicon/Health.svg')
  })
})
