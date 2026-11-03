import { describe, expect, it } from 'vitest'
import { placePopoverNearAnchor } from '../popoverPlacement'

const viewport = { width: 1000, height: 800 }
const size = { width: 300, height: 450 }

describe('placePopoverNearAnchor', () => {
  it('sous le nom quand il y a la place', () => {
    const anchor = { top: 100, bottom: 120, left: 50 }
    expect(placePopoverNearAnchor(anchor, size, viewport)).toEqual({ top: 128, left: 50 })
  })

  it('au-dessus du nom quand le bas de page couperait la card', () => {
    const anchor = { top: 600, bottom: 620, left: 50 }
    expect(placePopoverNearAnchor(anchor, size, viewport)).toEqual({ top: 142, left: 50 })
  })

  it('ni dessous ni dessus : collée au bas de l’écran, jamais coupée en bas', () => {
    const anchor = { top: 300, bottom: 320, left: 50 }
    const tall = { width: 300, height: 700 }
    expect(placePopoverNearAnchor(anchor, tall, viewport)).toEqual({ top: 88, left: 50 })
  })

  it('plus haute que l’écran : collée en haut', () => {
    const anchor = { top: 300, bottom: 320, left: 50 }
    expect(placePopoverNearAnchor(anchor, { width: 300, height: 900 }, viewport).top).toBe(12)
  })

  it('reste dans la largeur de l’écran', () => {
    const anchor = { top: 100, bottom: 120, left: 900 }
    expect(placePopoverNearAnchor(anchor, size, viewport).left).toBe(688)
  })
})
