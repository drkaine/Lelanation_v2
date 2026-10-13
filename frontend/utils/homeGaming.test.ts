import { describe, expect, it } from 'vitest'
import { homeGuides, homePatchRecap, pickHeroRow, tierRank, topPicksByRole } from './homeGaming'

const row = (championId: number, tier: string, rank = championId) => ({
  rank,
  championId,
  tier,
  mainRole: 'TOP',
})

describe('tierRank', () => {
  it('tier_rank_orders_s_plus_before_s_before_a', () => {
    expect(tierRank('S+')).toBeLessThan(tierRank('S'))
    expect(tierRank('S')).toBeLessThan(tierRank('A'))
  })

  it('tier_rank_puts_unknown_tier_last', () => {
    expect(tierRank('?')).toBeGreaterThan(tierRank('F'))
  })
})

describe('topPicksByRole', () => {
  it('top_picks_keeps_n_best_by_tier_then_rank', () => {
    const blocks = [
      { role: 'TOP', champions: [row(3, 'A'), row(1, 'S'), row(2, 'S+'), row(4, 'S')] },
    ]
    const [top] = topPicksByRole(blocks, 3)
    expect(top!.champions.map(c => c.championId)).toEqual([2, 1, 4])
  })

  it('top_picks_does_not_mutate_input', () => {
    const champions = [row(3, 'A'), row(2, 'S+')]
    topPicksByRole([{ role: 'TOP', champions }], 1)
    expect(champions.map(c => c.championId)).toEqual([3, 2])
  })
})

describe('pickHeroRow', () => {
  it('pick_hero_returns_best_champion_across_roles', () => {
    const blocks = [
      { role: 'TOP', champions: [row(1, 'A')] },
      { role: 'MIDDLE', champions: [row(7, 'S+')] },
    ]
    expect(pickHeroRow(blocks)?.championId).toBe(7)
  })

  it('pick_hero_returns_null_when_no_data', () => {
    expect(pickHeroRow([{ role: 'TOP', champions: [] }])).toBeNull()
  })
})

describe('homeGuides', () => {
  const guide = (id: string, updatedAt: string, visibility?: 'public' | 'private') => ({
    id,
    updatedAt,
    visibility,
  })

  it('home_guides_hidden_when_five_or_less', () => {
    const five = ['1', '2', '3', '4', '5'].map(id => guide(id, `2026-01-0${id}`))
    expect(homeGuides(five, 4)).toEqual([])
  })

  it('home_guides_shows_most_recent_public_when_more_than_five', () => {
    const guides = [
      guide('a', '2026-01-01'),
      guide('b', '2026-01-06'),
      guide('c', '2026-01-03'),
      guide('d', '2026-01-04', 'private'),
      guide('e', '2026-01-05'),
      guide('f', '2026-01-02'),
      guide('g', '2026-01-07'),
    ]
    expect(homeGuides(guides, 3).map(g => g.id)).toEqual(['g', 'b', 'e'])
  })
})

describe('homePatchRecap', () => {
  const entity = (name: string, category: string, type: 'buff' | 'nerf' | 'adjustment') => ({
    name,
    category,
    changes: [{ stat: 's', before: '1', after: '2', type }],
  })

  it('home_patch_recap_lists_champions_then_items_then_runes_per_side', () => {
    const recap = homePatchRecap([
      entity('Trinity', 'item', 'nerf'),
      entity('Ahri', 'champion', 'buff'),
      entity('Zed', 'champion', 'nerf'),
      entity('Sunfire', 'item', 'buff'),
      entity('Conqueror', 'rune', 'buff'),
      entity('Lux', 'champion', 'buff'),
      entity('Hydra', 'item', 'buff'),
    ])
    expect(recap.buffs.map(e => e.name)).toEqual(['Ahri', 'Lux', 'Sunfire', 'Hydra', 'Conqueror'])
    expect(recap.nerfs.map(e => e.name)).toEqual(['Zed', 'Trinity'])
  })

  it('home_patch_recap_lists_as_many_entities_as_counted', () => {
    const champs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => entity(n, 'champion', 'buff'))
    const recap = homePatchRecap([...champs, entity('Conqueror', 'rune', 'buff')])
    expect(recap.counts).toEqual([{ id: 'buff', count: 8 }])
    expect(recap.buffs).toHaveLength(8)
  })

  it('home_patch_recap_counts_tags_and_picks_champion_buffs_nerfs', () => {
    const recap = homePatchRecap([
      entity('Ahri', 'champion', 'buff'),
      entity('Zed', 'champion', 'nerf'),
      entity('Lux', 'champion', 'buff'),
      entity('Garen', 'champion', 'adjustment'),
      entity('Trinity', 'item', 'nerf'),
      entity('Mode', 'aram', 'buff'),
    ])
    expect(recap.counts).toEqual([
      { id: 'buff', count: 2 },
      { id: 'nerf', count: 2 },
      { id: 'adjustment', count: 1 },
    ])
    expect(recap.buffs.map(e => e.name)).toEqual(['Ahri', 'Lux'])
    expect(recap.nerfs.map(e => e.name)).toEqual(['Zed', 'Trinity'])
    expect(recap.adjustments.map(e => e.name)).toEqual(['Garen'])
    expect(recap.championCount).toBe(4)
  })
})
