import { describe, expect, it } from 'vitest'
import { buildParticipationCard } from '../../../../src/services/objectivesParticipationCard.js'

describe('buildParticipationCard', () => {
  const row = {
    sum_epic_monster_steals: 12n,
    sum_epic_monster_stolen_without_smite: 9n,
    sum_objectives_stolen: 30n,
    sum_solo_baron_kills: 2n,
    // Champ retiré par Riot (patch 16.23) : ignoré.
    sum_solo_turrets_lategame: 50n,
    sum_solo_kills: 40n,
    // Compteurs timeline jamais remplis : ne doivent plus rien produire.
    sum_baron_kills: 90n,
    count_baron_assist: 0n,
  }

  it('calcule les vols et solos depuis les challenges Riot (par partie, en %)', () => {
    expect(buildParticipationCard(row, 1000)).toEqual({
      stealPct: 1.2,
      stealWithSmitePct: 0.3,
      stealWithoutSmitePct: 0.9,
      soloBaronPct: 0.2,
      soloKillPct: 4,
    })
  })

  it('retombe sur objectives_stolen sans epic_monster_steals', () => {
    const card = buildParticipationCard({ sum_objectives_stolen: 5n }, 100)
    expect(card.stealPct).toBe(5)
    expect(card.stealWithSmitePct).toBe(5)
  })

  it('renvoie des zéros sans parties ni données', () => {
    expect(buildParticipationCard(undefined, 0)).toEqual({
      stealPct: 0,
      stealWithSmitePct: 0,
      stealWithoutSmitePct: 0,
      soloBaronPct: 0,
      soloKillPct: 0,
    })
  })
})
