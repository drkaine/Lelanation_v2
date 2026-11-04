import { describe, expect, it } from 'vitest'
import { trendChartDomain } from '../trendDomain'

describe('trendChartDomain', () => {
  it('borne un pourcentage à 100', () => {
    const d = trendChartDomain(40, 100, 'winrate')
    expect(d.max).toBe(100)
    expect(d.min).toBeGreaterThanOrEqual(0)
  })
  it('garde une marge sous 100', () => {
    const d = trendChartDomain(48, 52, 'winrate')
    expect(d.max).toBeCloseTo(52.32)
    expect(d.min).toBeCloseTo(47.52)
  })
  it('parties : part de 0, sans plafond', () => {
    expect(trendChartDomain(10, 500, 'games')).toEqual({ min: 0, max: 540 })
  })
  it('valeur plate : écart minimal', () => {
    const d = trendChartDomain(2, 2, 'pickrate')
    expect(d.max).toBeGreaterThan(2)
  })
})
