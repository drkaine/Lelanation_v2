import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TIER_CHART_COLORS, tierChartColor } from './tierChartColors'
import { metaBubbleColor } from './statistics/metaBubbleColor'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('tiers : une seule palette (palette d’origine)', () => {
  it('les tokens CSS des badges reprennent TIER_CHART_COLORS', () => {
    const css = read('assets/css/tokens.css')
    const token = (k: string) =>
      css.match(new RegExp(`--color-tier-badge-${k}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase()
    expect(token('s-plus')).toBe(TIER_CHART_COLORS['S+'])
    expect(token('s')).toBe(TIER_CHART_COLORS.S)
    expect(token('a')).toBe(TIER_CHART_COLORS.A)
    expect(token('b')).toBe(TIER_CHART_COLORS.B)
    expect(token('c')).toBe(TIER_CHART_COLORS.C)
    expect(token('d')).toBe(TIER_CHART_COLORS.D)
  })

  it('bulles du graphique méta = palette d’origine', () => {
    for (const t of ['S+', 'S', 'A', 'B', 'C', 'D', 'F']) {
      expect(metaBubbleColor(t)).toBe(tierChartColor(t))
    }
  })

  it('aucun onglet stats ne code une couleur de tier en dur', () => {
    const dir = 'components/statistics/tabs'
    for (const f of readdirSync(join(root, dir)).filter(x => x.endsWith('.vue'))) {
      expect(read(`${dir}/${f}`), f).not.toMatch(/row\.tier === '[^']+' && 'bg-\[#/)
    }
  })
})
