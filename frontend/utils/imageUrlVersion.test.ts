import { describe, expect, it } from 'vitest'
import {
  getChampionImageUrl,
  getChampionPassiveImageUrl,
  getChampionSplashImageUrl,
  getChampionSpellImageUrl,
  getItemImageUrl,
  getSpellImageUrl,
} from './imageUrl'
import { getStaticImageUrl } from './staticDataUrl'

describe('URL images versionnées par patch (cache immuable)', () => {
  it('ajoute ?v=patch quand la version est un patch', () => {
    expect(getChampionImageUrl('16.1.1', 'Aatrox.png')).toBe(
      '/images/game/latest/champion/Aatrox.png?v=16.1.1'
    )
    expect(getChampionSplashImageUrl('16.1.1', 'Aatrox')).toBe(
      '/images/game/latest/champion/splash_Aatrox.jpg?v=16.1.1'
    )
    expect(getItemImageUrl('16.1.1', '3003.png')).toBe('/images/game/latest/item/3003.png?v=16.1.1')
    expect(getSpellImageUrl('16.1.1', 'SummonerFlash.png')).toBe(
      '/images/game/latest/spell/SummonerFlash.png?v=16.1.1'
    )
    expect(getChampionSpellImageUrl('16.1.1', 'Senna', 'SennaQ.png')).toBe(
      '/images/game/latest/champion-spell/Senna/SennaQ.png?v=16.1.1'
    )
    expect(getChampionPassiveImageUrl('16.1.1', 'P.png')).toBe(
      '/images/game/latest/champion-spell/passive/P.png?v=16.1.1'
    )
    expect(getStaticImageUrl('16.1.1', 'rune', 'x.png', 'paths')).toBe(
      '/images/game/latest/rune/paths/x.png?v=16.1.1'
    )
  })

  it('pas de version utilisable → URL inchangée ; image vide → vide', () => {
    expect(getChampionImageUrl('latest', 'Aatrox.png')).toBe(
      '/images/game/latest/champion/Aatrox.png'
    )
    expect(getItemImageUrl('', '3003.png')).toBe('/images/game/latest/item/3003.png')
    expect(getItemImageUrl('16.1.1', '')).toBe('')
  })
})
