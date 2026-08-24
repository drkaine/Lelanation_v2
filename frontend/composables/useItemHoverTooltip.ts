import { computed, nextTick, ref, watch } from 'vue'
import type { Item } from '~/types/build'
import { useTooltipsPreference } from '~/composables/useTooltipsPreference'

const TOOLTIP_OFFSET = 15

export function useItemHoverTooltip() {
  const { tooltipsEnabled } = useTooltipsPreference()
  const hoveredItem = ref<Item | null>(null)
  const tooltipRef = ref<HTMLElement | null>(null)
  const tooltipPosition = ref({ x: 0, y: 0 })

  const tooltipStyle = computed(() => {
    if (!hoveredItem.value) return {}
    return {
      left: `${tooltipPosition.value.x + TOOLTIP_OFFSET}px`,
      top: `${tooltipPosition.value.y + TOOLTIP_OFFSET}px`,
    }
  })

  function updateTooltipPosition() {
    if (!tooltipRef.value || !hoveredItem.value) return

    const tooltip = tooltipRef.value
    const rect = tooltip.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let x = tooltipPosition.value.x + TOOLTIP_OFFSET
    let y = tooltipPosition.value.y + TOOLTIP_OFFSET

    if (x + rect.width > viewportWidth) {
      x = tooltipPosition.value.x - rect.width - TOOLTIP_OFFSET
    }
    if (y + rect.height > viewportHeight) {
      y = tooltipPosition.value.y - rect.height - TOOLTIP_OFFSET
    }
    if (x < 0) x = TOOLTIP_OFFSET
    if (y < 0) y = TOOLTIP_OFFSET

    tooltip.style.left = `${x}px`
    tooltip.style.top = `${y}px`
  }

  function handleItemHover(item: Item, event: MouseEvent) {
    if (!tooltipsEnabled.value) return
    hoveredItem.value = item
    tooltipPosition.value = { x: event.clientX, y: event.clientY }
    nextTick(() => updateTooltipPosition())
  }

  function handleMouseMove(event: MouseEvent) {
    if (!tooltipsEnabled.value || !hoveredItem.value) return
    tooltipPosition.value = { x: event.clientX, y: event.clientY }
    nextTick(() => updateTooltipPosition())
  }

  function clearItemHover() {
    hoveredItem.value = null
  }

  watch(hoveredItem, async newValue => {
    if (newValue) {
      await nextTick()
      updateTooltipPosition()
      window.addEventListener('scroll', updateTooltipPosition, true)
      window.addEventListener('resize', updateTooltipPosition)
    } else {
      window.removeEventListener('scroll', updateTooltipPosition, true)
      window.removeEventListener('resize', updateTooltipPosition)
    }
  })

  return {
    tooltipsEnabled,
    hoveredItem,
    tooltipRef,
    tooltipStyle,
    handleItemHover,
    handleMouseMove,
    clearItemHover,
  }
}
