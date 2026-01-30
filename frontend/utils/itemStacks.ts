/**
 * Catalogue des items stackables et leurs formules de bonus par stack.
 * Source: Data Dragon descriptions + wiki / Community Dragon.
 */
export interface ItemStackFormula {
  itemId: string
  itemName: string
  maxStacks: number
  formula: (stacks: number) => {
    health?: number
    armor?: number
    attackDamage?: number
    abilityPower?: number
    magicResist?: number
    [key: string]: number | undefined
  }
}

/**
 * Catalogue des items stackables (exemples principaux).
 * À étendre selon les besoins et les patches.
 */
export const STACKABLE_ITEMS: Record<string, ItemStackFormula> = {
  // Cœur d'acier (Heart of Steel) - ID à vérifier selon version
  '3031': {
    itemId: '3031',
    itemName: "Cœur d'acier",
    maxStacks: 10,
    formula: (stacks: number) => ({
      armor: stacks * 3, // +3 armure par stack (à vérifier selon patch)
      health: stacks * 50, // +50 HP par stack (à vérifier)
    }),
  },
  // Mejai's Soulstealer - ID à vérifier
  '3041': {
    itemId: '3041',
    itemName: "Mejai's Soulstealer",
    maxStacks: 25,
    formula: (stacks: number) => ({
      abilityPower: stacks * 5, // +5 AP par stack (à vérifier)
    }),
  },
  // Muramana / Manamune - ID à vérifier
  '3042': {
    itemId: '3042',
    itemName: 'Manamune',
    maxStacks: 360,
    formula: (stacks: number) => ({
      attackDamage: Math.floor(stacks / 12), // +1 AD tous les 12 stacks (à vérifier)
    }),
  },
  // Void Staff (stacks légendaires) - exemple, à vérifier
  '3135': {
    itemId: '3135',
    itemName: 'Void Staff',
    maxStacks: 1, // Pas vraiment des stacks, mais exemple
    formula: () => ({}),
  },
}

/**
 * Vérifie si un item est stackable.
 */
export function isStackableItem(itemId: string): boolean {
  return itemId in STACKABLE_ITEMS
}

/**
 * Obtient la formule de stack pour un item.
 */
export function getItemStackFormula(itemId: string): ItemStackFormula | null {
  return STACKABLE_ITEMS[itemId] || null
}

/**
 * Calcule les bonus de stats pour un item avec un nombre de stacks donné.
 */
export function calculateItemStackStats(
  itemId: string,
  stacks: number
): {
  health?: number
  armor?: number
  attackDamage?: number
  abilityPower?: number
  magicResist?: number
  [key: string]: number | undefined
} {
  const formula = getItemStackFormula(itemId)
  if (!formula) return {}
  const clampedStacks = Math.max(0, Math.min(stacks, formula.maxStacks))
  return formula.formula(clampedStacks)
}
