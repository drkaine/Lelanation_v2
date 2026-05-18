export type TooltipPointer = { x: number; y: number }

const VIEWPORT_MARGIN = 8

/** Place a fixed tooltip near the cursor, flipping when it would overflow the viewport. */
export function positionFixedTooltipNearPointer(
  tooltipEl: HTMLElement,
  pointer: TooltipPointer,
  offset = 16
): { top: number; left: number } {
  const rect = tooltipEl.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = pointer.x + offset
  let top = pointer.y + offset

  if (left + rect.width > viewportWidth - VIEWPORT_MARGIN) {
    left = pointer.x - rect.width - offset
  }
  if (top + rect.height > viewportHeight - VIEWPORT_MARGIN) {
    top = pointer.y - rect.height - offset
  }

  left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - rect.width - VIEWPORT_MARGIN))
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - rect.height - VIEWPORT_MARGIN))

  return { top, left }
}

export function fixedTooltipStyleFromPointer(
  tooltipEl: HTMLElement,
  pointer: TooltipPointer,
  offset = 16
): Record<string, string> {
  const { top, left } = positionFixedTooltipNearPointer(tooltipEl, pointer, offset)
  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
  }
}
