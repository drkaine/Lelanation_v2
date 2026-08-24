import type { Item } from '../types/build'

export type ItemRecipeTreeSize = 'lg' | 'md' | 'sm'

export interface ItemRecipeTreeNode {
  item: Item
  children: ItemRecipeTreeNode[]
}

export const ITEM_RECIPE_TREE_ICON_SIZE: Record<ItemRecipeTreeSize, number> = {
  lg: 58,
  md: 42,
  sm: 28,
}

/** Build a 3-tier recipe tree: item → components → sub-components. */
export function buildItemRecipeTree(
  item: Item,
  itemsById: Map<string, Item>,
  currentDepth = 0,
  maxDepth = 2
): ItemRecipeTreeNode {
  const fromIds = item.from ?? []
  const children =
    currentDepth >= maxDepth
      ? []
      : fromIds
          .map(id => itemsById.get(id))
          .filter((child): child is Item => Boolean(child))
          .map(child => buildItemRecipeTree(child, itemsById, currentDepth + 1, maxDepth))

  return { item, children }
}

export function buildItemRecipeTreeFromCatalog(item: Item, catalog: Item[]): ItemRecipeTreeNode {
  const itemsById = new Map(catalog.map(entry => [entry.id, entry]))
  return buildItemRecipeTree(item, itemsById)
}
