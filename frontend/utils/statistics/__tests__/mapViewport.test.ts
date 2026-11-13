import { describe, expect, it } from 'vitest'
import { FULL_VIEW, panView, viewBoxAttr, zoomView } from '../mapViewport'

describe('zoomView', () => {
  it('zoome autour du point visé sans sortir de la carte', () => {
    expect(zoomView(FULL_VIEW, 2, 50, 50)).toEqual({ x: 25, y: 25, w: 50 })
    expect(zoomView(FULL_VIEW, 2, 0, 0)).toEqual({ x: 0, y: 0, w: 50 })
    expect(zoomView({ x: 50, y: 50, w: 50 }, 0.5, 100, 100)).toEqual(FULL_VIEW)
  })
  it('borne le zoom (x8 max, carte entière min)', () => {
    expect(zoomView(FULL_VIEW, 100, 50, 50).w).toBe(12.5)
    expect(zoomView(FULL_VIEW, 0.1, 50, 50)).toEqual(FULL_VIEW)
  })
})

describe('panView', () => {
  it('déplace en restant dans la carte', () => {
    expect(panView({ x: 25, y: 25, w: 50 }, 10, -5)).toEqual({ x: 35, y: 20, w: 50 })
    expect(panView({ x: 25, y: 25, w: 50 }, 100, -100)).toEqual({ x: 50, y: 0, w: 50 })
    expect(panView(FULL_VIEW, 10, 10)).toEqual(FULL_VIEW)
  })
  it('formate le viewBox', () => {
    expect(viewBoxAttr({ x: 1, y: 2, w: 50 })).toBe('1 2 50 50')
  })
})
