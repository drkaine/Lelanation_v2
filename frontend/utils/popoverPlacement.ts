export interface PopoverAnchor {
  top: number
  bottom: number
  left: number
}

export interface PopoverSize {
  width: number
  height: number
}

export interface PopoverViewport {
  width: number
  height: number
}

/** Place un popover sous l'ancre, sinon au-dessus, toujours dans l'écran. */
export function placePopoverNearAnchor(
  anchor: PopoverAnchor,
  size: PopoverSize,
  viewport: PopoverViewport,
  gap = 8,
  margin = 12
): { top: number; left: number } {
  const maxTop = viewport.height - size.height - margin
  const below = anchor.bottom + gap
  const above = anchor.top - gap - size.height
  let top: number
  if (below <= maxTop) top = below
  else if (above >= margin) top = above
  else top = maxTop
  top = Math.max(margin, top)

  let left = anchor.left
  if (left + size.width > viewport.width - margin) {
    left = viewport.width - size.width - margin
  }
  left = Math.max(margin, left)
  return { top, left }
}
