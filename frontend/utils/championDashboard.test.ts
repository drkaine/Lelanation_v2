import { describe, expect, it } from 'vitest'
import {
  barWidthPct,
  breakdownSharePct,
  formatDashboardValue,
  radarPoint,
  radarPolygonPoints,
  topItemsFromBuilds,
} from './championDashboard'

describe('radarPoint', () => {
  it('place le premier axe à droite du centre', () => {
    const p = radarPoint(0, 8, 100, 100, 150, 150)
    expect(p.x).toBeCloseTo(250)
    expect(p.y).toBeCloseTo(150)
  })

  it('place le troisième axe (sur 8) en haut, sens anti-horaire', () => {
    const p = radarPoint(2, 8, 100, 100, 150, 150)
    expect(p.x).toBeCloseTo(150)
    expect(p.y).toBeCloseTo(50)
  })

  it('valeur 0 = centre, valeur hors bornes bornée à 100', () => {
    expect(radarPoint(1, 8, 0, 100, 10, 20)).toEqual({ x: 10, y: 20 })
    const p = radarPoint(0, 8, 500, 100, 0, 0)
    expect(p.x).toBeCloseTo(100)
  })

  it('NaN traité comme 0', () => {
    const p = radarPoint(0, 8, Number.NaN, 100, 5, 5)
    expect(p).toEqual({ x: 5, y: 5 })
  })
})

describe('radarPolygonPoints', () => {
  it('produit un point par valeur', () => {
    const pts = radarPolygonPoints([100, 50, 0, 25], 100, 0, 0).split(' ')
    expect(pts).toHaveLength(4)
    expect(pts[0]).toBe('100.00,0.00')
  })
})

describe('barWidthPct', () => {
  it('borne entre 0 et 100', () => {
    expect(barWidthPct(-5)).toBe(0)
    expect(barWidthPct(150)).toBe(100)
    expect(barWidthPct(42.5)).toBe(42.5)
    expect(barWidthPct(Number.NaN)).toBe(0)
  })
})

describe('formatDashboardValue', () => {
  it('formate avec séparateur de milliers et décimales fixes', () => {
    expect(formatDashboardValue(22007.4)).toBe('22,007')
    expect(formatDashboardValue(1.8, 2)).toBe('1.80')
    expect(formatDashboardValue(Number.NaN)).toBe('—')
  })
})

describe('topItemsFromBuilds', () => {
  it('somme les parties par objet, une fois par build, trié décroissant', () => {
    const top = topItemsFromBuilds(
      [
        { items: [1, 2, 2], games: 10 },
        { items: [2, 3], games: 5 },
        { items: [0, 3], games: 1 },
      ],
      2
    )
    expect(top).toEqual([
      { itemId: 2, games: 15 },
      { itemId: 1, games: 10 },
    ])
  })

  it('ignore les ids nuls et respecte la limite', () => {
    expect(topItemsFromBuilds([{ items: [0], games: 9 }], 3)).toEqual([])
  })
})

describe('breakdownSharePct', () => {
  it('part de la sous-ligne dans la valeur parente', () => {
    expect(breakdownSharePct(6908, 7631)).toBeCloseTo(90.5, 1)
  })
  it('parent nul ou invalide → 0, dépassement borné à 100', () => {
    expect(breakdownSharePct(5, 0)).toBe(0)
    expect(breakdownSharePct(Number.NaN, 10)).toBe(0)
    expect(breakdownSharePct(20, 10)).toBe(100)
  })
})
