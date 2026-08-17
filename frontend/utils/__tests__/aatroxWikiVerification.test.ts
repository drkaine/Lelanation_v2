/**
 * Vérification des données theorycraft contre le wiki officiel LoL.
 * Référence : https://wiki.leagueoflegends.com/en-us/Aatrox
 * Les stats par niveau suivent la courbe Riot g × (n−1) × (0.7025 + 0.0175 × (n−1)).
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { championGrowthMultiplier } from '@lelanation/builds-stats/championGrowth'
import type { Champion } from '@lelanation/shared-types'
import { baseHpAtLevel, championWithStatsForBuild } from '../theorycraftStats'

const dataRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data', 'game')

function loadAatrox() {
  const { currentVersion } = JSON.parse(readFileSync(join(dataRoot, 'version.json'), 'utf-8')) as {
    currentVersion: string
  }
  const raw = JSON.parse(
    readFileSync(join(dataRoot, currentVersion, 'fr_FR', 'champions', 'aatrox.json'), 'utf-8')
  ) as { champion: Record<string, never> }
  return raw.champion as {
    baseStats: Record<string, number>
    growthStats: Record<string, number>
    spells: Array<{
      slot: string
      calculations?: Array<{
        key: string
        baseValues?: number[]
        ratios?: Array<{ stat: string; coefficient: number[] }>
      }>
    }>
  }
}

describe('Aatrox — vérification wiki (base stats)', () => {
  const champion = loadAatrox()

  it('correspond aux stats de base du wiki', () => {
    expect(champion.baseStats.hp).toBe(650)
    expect(champion.baseStats.hpRegen).toBe(3)
    expect(champion.baseStats.armor).toBe(38)
    expect(champion.baseStats.magicResist).toBe(32)
    expect(champion.baseStats.attackDamage).toBe(60)
    expect(champion.baseStats.attackSpeed).toBeCloseTo(0.651, 3)
    expect(champion.baseStats.movespeed).toBe(345)
    expect(champion.baseStats.attackRange).toBe(175)
  })

  it('correspond aux croissances par niveau du wiki (dont AD +5, bug DDragon corrigé)', () => {
    expect(champion.growthStats.hp).toBe(114)
    expect(champion.growthStats.hpRegen).toBe(0.5)
    expect(champion.growthStats.armor).toBe(4.8)
    expect(champion.growthStats.magicResist).toBe(2.05)
    expect(champion.growthStats.attackDamage).toBe(5)
    expect(champion.growthStats.attackSpeed).toBe(2.5)
  })
})

describe('Aatrox — vérification wiki (ratios des sorts)', () => {
  const champion = loadAatrox()
  const calc = (slot: string, key: string) =>
    champion.spells.find(s => s.slot === slot)?.calculations?.find(c => c.key === key)

  it('Q Épée des Darkin : 10-70 (+60/67.5/75/82.5/90 % AD total)', () => {
    const q = calc('Q', 'qdamage')
    expect(q?.baseValues).toEqual([10, 25, 40, 55, 70])
    const ratio = q?.ratios?.[0]
    expect(ratio?.stat).toBe('totalAD')
    expect(ratio?.coefficient.map(v => Math.round(v * 1000) / 1000)).toEqual([
      0.6, 0.675, 0.75, 0.825, 0.9,
    ])
  })

  it('W Chaînes infernales : 30-70 (+40 % AD total)', () => {
    const w = calc('W', 'wdamage')
    expect(w?.baseValues).toEqual([30, 40, 50, 60, 70])
    const ratio = w?.ratios?.[0]
    expect(ratio?.stat).toBe('totalAD')
    expect(ratio?.coefficient.map(v => Math.round(v * 100) / 100)).toEqual([
      0.4, 0.4, 0.4, 0.4, 0.4,
    ])
  })

  it('E Ruée obscure : 16 % de vol dégâts→PV', () => {
    const e = calc('E', 'totalevamp')
    expect(e?.baseValues).toEqual([0.16, 0.16, 0.16, 0.16, 0.16])
  })
})

describe('Aatrox — courbe de croissance Riot', () => {
  it('multiplicateur : 0 au niveau 1, 17 au niveau 18 (identique au linéaire aux extrêmes)', () => {
    expect(championGrowthMultiplier(1)).toBe(0)
    expect(championGrowthMultiplier(18)).toBeCloseTo(17, 10)
  })

  it('PV par niveau conformes au wiki (650 + 114 × courbe)', () => {
    const champion = loadAatrox()
    const asChampion = championWithStatsForBuild({
      id: 'Aatrox',
      baseStats: champion.baseStats,
      growthStats: champion.growthStats,
    } as unknown as Champion)

    // Wiki niveau 18 : 650 + 114 × 17 = 2588 PV
    expect(baseHpAtLevel(asChampion, 18)).toBeCloseTo(2588, 5)
    // Niveau 10 : mult = 9 × (0.7025 + 0.0175 × 9) = 7.74 → 650 + 114 × 7.74 = 1532.36
    expect(baseHpAtLevel(asChampion, 10)).toBeCloseTo(1532.36, 2)
    // Niveau 2 : mult = 0.72 → la version linéaire (764) surestimait
    expect(baseHpAtLevel(asChampion, 2)).toBeCloseTo(650 + 114 * 0.72, 5)
  })
})
