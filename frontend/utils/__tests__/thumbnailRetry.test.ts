import { describe, expect, it } from 'vitest'
import { thumbnailRetrySrc, THUMBNAIL_MAX_RETRIES } from '../thumbnailRetry'

describe('thumbnailRetrySrc', () => {
  const src = '/api/youtube/image?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fabc%2Fhqdefault.jpg'

  it('ajoute un paramètre de retry pour forcer un nouveau chargement', () => {
    expect(thumbnailRetrySrc(src, 1)).toBe(`${src}&retry=1`)
  })

  it('remplace le paramètre de retry précédent', () => {
    expect(thumbnailRetrySrc(`${src}&retry=1`, 2)).toBe(`${src}&retry=2`)
  })

  it('utilise ? quand l’URL n’a pas de query', () => {
    expect(thumbnailRetrySrc('/img.jpg', 1)).toBe('/img.jpg?retry=1')
  })

  it('abandonne après le nombre max de tentatives', () => {
    expect(thumbnailRetrySrc(src, THUMBNAIL_MAX_RETRIES + 1)).toBe('')
  })

  it('n’essaie pas de relancer une source vide', () => {
    expect(thumbnailRetrySrc('', 1)).toBe('')
  })
})
