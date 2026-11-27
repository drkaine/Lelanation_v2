import { describe, expect, it } from 'vitest'
import { acceptsWebp, imageCandidates, imageCacheControl, withImageVersion } from './imageVariant'

describe('imageVariant', () => {
  it('détecte WebP dans Accept', () => {
    expect(acceptsWebp('image/avif,image/webp,image/apng,*/*;q=0.8')).toBe(true)
    expect(acceptsWebp('image/png,*/*')).toBe(false)
    expect(acceptsWebp(undefined)).toBe(false)
  })

  it('candidats : variante WebP d’abord pour PNG/JPG si acceptée', () => {
    expect(imageCandidates('/x/Aatrox.png', 'image/webp')).toEqual([
      '/x/Aatrox.png.webp',
      '/x/Aatrox.png',
    ])
    expect(imageCandidates('/x/splash.jpg', 'image/webp')).toEqual([
      '/x/splash.jpg.webp',
      '/x/splash.jpg',
    ])
    expect(imageCandidates('/x/Aatrox.png', 'image/png')).toEqual(['/x/Aatrox.png'])
    expect(imageCandidates('/x/a.gif', 'image/webp')).toEqual(['/x/a.gif'])
  })

  it('version de patch en paramètre ; rien si version inconnue', () => {
    expect(withImageVersion('/images/game/latest/item/1001.png', '16.1.1')).toBe(
      '/images/game/latest/item/1001.png?v=16.1.1'
    )
    expect(withImageVersion('/a.png', '16.1')).toBe('/a.png?v=16.1')
    expect(withImageVersion('/a.png', 'latest')).toBe('/a.png')
    expect(withImageVersion('/a.png', '')).toBe('/a.png')
    expect(withImageVersion('', '16.1.1')).toBe('')
  })

  it('cache : immuable si versionnée, sinon une semaine', () => {
    expect(imageCacheControl(true)).toBe('public, max-age=31536000, immutable')
    expect(imageCacheControl(false)).toBe('public, max-age=604800')
  })
})
