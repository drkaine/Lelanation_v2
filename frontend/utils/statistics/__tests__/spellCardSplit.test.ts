import { describe, expect, it } from 'vitest'
import { spellCardSplit } from '~/utils/statistics/spellCardSplit'

const r = (id: number, pickrate: number) => ({ id, pickrate })

describe('spellCardSplit', () => {
  it('cartes = sorts au-dessus du seuil, triés par pick, max 4', () => {
    const out = spellCardSplit(
      [r(1, 24.7), r(2, 99.8), r(3, 0.3), r(4, 44.6), r(5, 30.3), r(6, 2)],
      1,
      4
    )
    expect(out.cards.map(x => x.id)).toEqual([2, 4, 5, 1])
    expect(out.rest.map(x => x.id)).toEqual([6, 3])
  })

  it('aucun sort au-dessus du seuil : pas de carte', () => {
    const out = spellCardSplit([r(1, 0.5)], 1, 4)
    expect(out.cards).toEqual([])
    expect(out.rest.map(x => x.id)).toEqual([1])
  })

  it('pick non fini traité comme 0', () => {
    const out = spellCardSplit([r(1, Number.NaN), r(2, 5)], 1, 4)
    expect(out.cards.map(x => x.id)).toEqual([2])
    expect(out.rest.map(x => x.id)).toEqual([1])
  })
})
