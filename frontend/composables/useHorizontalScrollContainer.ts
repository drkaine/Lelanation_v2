import type { Ref } from 'vue'

type HorizontalScrollOptions = {
  /** Pixels before pointer move counts as drag (avoids blocking tab clicks). */
  dragThreshold?: number
}

function isOverflowing(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1
}

function updateScrollableState(el: HTMLElement): void {
  el.classList.toggle('has-horizontal-scroll', isOverflowing(el))
}

/**
 * Wheel → horizontal scroll + click-drag on overflow-x tab bars.
 * Adds `has-horizontal-scroll` when content overflows (shows scrollbar).
 */
export function useHorizontalScrollContainer(
  containerRef: Ref<HTMLElement | null>,
  options: HorizontalScrollOptions = {}
): void {
  const dragThreshold = options.dragThreshold ?? 6

  let isPointerDown = false
  let isDragging = false
  let startX = 0
  let scrollLeftStart = 0
  let boundEl: HTMLElement | null = null
  let resizeObserver: ResizeObserver | null = null
  let mutationObserver: MutationObserver | null = null
  let onWindowResize: (() => void) | null = null

  function canScroll(el: HTMLElement): boolean {
    return isOverflowing(el)
  }

  function observeChildren(el: HTMLElement): void {
    if (!resizeObserver) return
    for (const child of el.children) {
      if (child instanceof HTMLElement) resizeObserver.observe(child)
    }
  }

  function startOverflowWatch(el: HTMLElement): void {
    updateScrollableState(el)
    onWindowResize = () => updateScrollableState(el)
    window.addEventListener('resize', onWindowResize, { passive: true })

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollableState(el))
      resizeObserver.observe(el)
      observeChildren(el)
    }

    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        updateScrollableState(el)
        observeChildren(el)
      })
      mutationObserver.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      })
    }
  }

  function stopOverflowWatch(el: HTMLElement): void {
    if (onWindowResize) {
      window.removeEventListener('resize', onWindowResize)
      onWindowResize = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    mutationObserver?.disconnect()
    mutationObserver = null
    el.classList.remove('has-horizontal-scroll')
  }

  function onPointerDown(e: PointerEvent): void {
    const el = containerRef.value
    if (!el || e.button !== 0 || !canScroll(el)) return
    isPointerDown = true
    isDragging = false
    startX = e.clientX
    scrollLeftStart = el.scrollLeft
  }

  function onPointerMove(e: PointerEvent): void {
    const el = containerRef.value
    if (!el || !isPointerDown) return
    const dx = e.clientX - startX
    if (!isDragging && Math.abs(dx) > dragThreshold) {
      isDragging = true
      el.classList.add('is-drag-scrolling')
    }
    if (!isDragging) return
    e.preventDefault()
    el.scrollLeft = scrollLeftStart - dx
  }

  function endPointerDrag(e: PointerEvent): void {
    const el = containerRef.value
    if (!el) return
    if (isDragging) {
      const preventClick = (ev: Event) => {
        ev.preventDefault()
        ev.stopImmediatePropagation()
      }
      el.addEventListener('click', preventClick, true)
      window.setTimeout(() => el.removeEventListener('click', preventClick, true), 0)
    }
    isPointerDown = false
    isDragging = false
    el.classList.remove('is-drag-scrolling')
    if (el.hasPointerCapture?.(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
  }

  function onPointerDownCapture(e: PointerEvent): void {
    const el = containerRef.value
    if (!el || e.button !== 0 || !canScroll(el)) return
    el.setPointerCapture(e.pointerId)
    onPointerDown(e)
  }

  function onWheel(e: WheelEvent): void {
    const el = containerRef.value
    if (!el || !canScroll(el)) return
    const delta =
      Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : e.deltaY
    if (delta === 0) return
    e.preventDefault()
    el.scrollLeft += delta
  }

  function bind(el: HTMLElement): void {
    boundEl = el
    startOverflowWatch(el)
    el.addEventListener('pointerdown', onPointerDownCapture)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPointerDrag)
    el.addEventListener('pointercancel', endPointerDrag)
    el.addEventListener('wheel', onWheel, { passive: false })
  }

  function unbind(el: HTMLElement): void {
    stopOverflowWatch(el)
    el.removeEventListener('pointerdown', onPointerDownCapture)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', endPointerDrag)
    el.removeEventListener('pointercancel', endPointerDrag)
    el.removeEventListener('wheel', onWheel)
    el.classList.remove('is-drag-scrolling')
    boundEl = null
  }

  watch(
    containerRef,
    (el, prev) => {
      if (prev) unbind(prev)
      if (el) bind(el)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    if (boundEl) unbind(boundEl)
  })
}
