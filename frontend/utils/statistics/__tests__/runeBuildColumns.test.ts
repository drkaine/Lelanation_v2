import { describe, expect, it } from 'vitest'
import { pickWithAlts, runeBuildColumns } from '~/utils/statistics/runeBuildColumns'

const r = (id: number) => ({ id, name: `r${id}`, icon: `i${id}` })
const path = (id: number, rows: number[][]) => ({
  id,
  name: `p${id}`,
  slots: rows.map(ids => ({ runes: ids.map(r) })),
})

describe('pickWithAlts', () => {
  it('rune la plus jouée puis alternatives au-dessus du seuil, triées', () => {
    const out = pickWithAlts(
      [
        { ...r(1), pick: 9, wr: 46 },
        { ...r(2), pick: 88, wr: 51 },
        { ...r(3), pick: 0.5, wr: 60 },
        { ...r(4), pick: 2, wr: 50 },
      ],
      1
    )
    expect(out?.id).toBe(2)
    expect(out?.alts.map(a => a.id)).toEqual([1, 4])
  })

  it('null quand personne ne la joue', () => {
    expect(pickWithAlts([{ ...r(1), pick: 0, wr: null }], 1)).toBeNull()
  })
})

describe('runeBuildColumns', () => {
  const paths = [
    path(10, [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]),
    path(20, [
      [11, 12],
      [13, 14],
      [15, 16],
      [17, 18],
    ]),
    path(30, [[21], [23, 24], [25, 26], [27, 28]]),
  ]
  const s = (pickrate: number) => ({ pickrate, winrate: 50 })
  const stats = {
    1: s(80),
    2: s(5),
    3: s(90),
    5: s(70),
    6: s(20),
    7: s(85),
    13: s(60),
    15: s(3),
    17: s(55),
    23: s(10),
    25: s(5),
  }

  it('principale = clé de voûte la plus jouée, 4 rangées', () => {
    const c = runeBuildColumns(paths, stats, 1)
    expect(c.primary?.pathId).toBe(10)
    expect(c.primary?.rows.map(x => x.id)).toEqual([1, 3, 5, 7])
    expect(c.primary?.rows[2]?.alts.map(a => a.id)).toEqual([6])
  })

  it('secondaire = autre arbre le plus joué hors clé, ses 2 meilleures rangées dans l’ordre', () => {
    const c = runeBuildColumns(paths, stats, 1)
    expect(c.secondary?.pathId).toBe(20)
    expect(c.secondary?.rows.map(x => x.id)).toEqual([13, 17])
  })

  it('sans stats : colonnes vides', () => {
    const c = runeBuildColumns(paths, {}, 1)
    expect(c.primary).toBeNull()
    expect(c.secondary).toBeNull()
  })
})
