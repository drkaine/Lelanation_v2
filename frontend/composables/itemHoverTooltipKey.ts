import type { InjectionKey } from 'vue'
import type { Item } from '~/types/build'

export type ItemHoverTooltipContext = {
  tooltipsEnabled: { value: boolean }
  hoveredItem: { value: Item | null }
  tooltipRef: { value: HTMLElement | null }
  tooltipStyle: { value: Record<string, string> }
  handleItemHover: (item: Item, event: MouseEvent) => void
  handleMouseMove: (event: MouseEvent) => void
  clearItemHover: () => void
}

export const ITEM_HOVER_TOOLTIP_KEY: InjectionKey<ItemHoverTooltipContext> =
  Symbol('itemHoverTooltip')
