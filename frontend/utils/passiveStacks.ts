/**
 * Catalogue des passifs stackables par champion et leurs formules.
 * Source: Community Dragon (formules précises) ou Data Dragon + wiki.
 */
export interface PassiveStackFormula {
  championId: string
  championName: string
  stackType: string // 'q', 'passive', 'souls', etc.
  maxStacks?: number // Optionnel (certains n'ont pas de max)
  formula: (
    stacks: number,
    level?: number
  ) => {
    abilityPower?: number
    attackDamage?: number
    health?: number
    attackRange?: number
    [key: string]: number | undefined
  }
}

/**
 * Catalogue des champions avec passifs stackables.
 * À étendre selon les besoins et les patches.
 */
export const STACKABLE_PASSIVES: Record<string, PassiveStackFormula[]> = {
  // Veigar: AP par Q farm
  Veigar: [
    {
      championId: 'Veigar',
      championName: 'Veigar',
      stackType: 'q',
      maxStacks: undefined, // Pas de max théorique
      formula: (stacks: number) => ({
        abilityPower: stacks * 1, // +1 AP par stack (à vérifier selon patch)
      }),
    },
  ],
  // Nasus: Dégâts bonus Q par kill
  Nasus: [
    {
      championId: 'Nasus',
      championName: 'Nasus',
      stackType: 'q',
      maxStacks: undefined,
      formula: (_stacks: number) => ({
        // Bonus dégâts Q (pas une stat directe, mais utilisé dans calcul dégâts)
        attackDamage: 0, // Pas de bonus AD direct
      }),
    },
  ],
  // Smolder: Stacks Q
  Smolder: [
    {
      championId: 'Smolder',
      championName: 'Smolder',
      stackType: 'q',
      maxStacks: 225,
      formula: (_stacks: number) => ({
        // Bonus dégâts Q (utilisé dans calcul dégâts, pas stat directe)
        attackDamage: 0,
      }),
    },
  ],
  // Sion: HP bonus par kill
  Sion: [
    {
      championId: 'Sion',
      championName: 'Sion',
      stackType: 'passive',
      maxStacks: undefined,
      formula: (stacks: number) => ({
        health: stacks * 4, // +4 HP par stack (à vérifier)
      }),
    },
  ],
  // Kindred: Marques
  Kindred: [
    {
      championId: 'Kindred',
      championName: 'Kindred',
      stackType: 'marks',
      maxStacks: 25,
      formula: (stacks: number) => ({
        attackRange: stacks * 5, // +5 range par marque (à vérifier)
        attackDamage: Math.floor(stacks / 4) * 1.25, // Bonus AD par 4 marques (à vérifier)
      }),
    },
  ],
  // Thresh: Armure / AP par âmes
  Thresh: [
    {
      championId: 'Thresh',
      championName: 'Thresh',
      stackType: 'souls',
      maxStacks: undefined,
      formula: (stacks: number) => ({
        armor: stacks * 0.75, // +0.75 armure par âme (à vérifier)
        abilityPower: stacks * 1, // +1 AP par âme (à vérifier)
      }),
    },
  ],
  // Bard: Chimes
  Bard: [
    {
      championId: 'Bard',
      championName: 'Bard',
      stackType: 'chimes',
      maxStacks: undefined,
      formula: (stacks: number) => ({
        abilityPower: Math.floor(stacks / 5) * 15, // +15 AP tous les 5 chimes (à vérifier)
      }),
    },
  ],
  // Senna: Âmes
  Senna: [
    {
      championId: 'Senna',
      championName: 'Senna',
      stackType: 'souls',
      maxStacks: undefined,
      formula: (stacks: number) => ({
        attackDamage: stacks * 0.75, // +0.75 AD par âme (à vérifier)
        // Crit chance et range aussi (à ajouter si besoin)
      }),
    },
  ],
}

/**
 * Obtient les formules de stack pour un champion.
 */
export function getChampionPassiveStacks(championId: string): PassiveStackFormula[] {
  return STACKABLE_PASSIVES[championId] || []
}

/**
 * Vérifie si un champion a des passifs stackables.
 */
export function hasStackablePassive(championId: string): boolean {
  return championId in STACKABLE_PASSIVES
}

/**
 * Calcule les bonus de stats pour un champion avec des stacks de passif.
 */
export function calculatePassiveStackStats(
  championId: string,
  stackType: string,
  stacks: number,
  level?: number
): {
  abilityPower?: number
  attackDamage?: number
  health?: number
  attackRange?: number
  [key: string]: number | undefined
} {
  const formulas = getChampionPassiveStacks(championId)
  const formula = formulas.find(f => f.stackType === stackType)
  if (!formula) return {}
  const clampedStacks = formula.maxStacks
    ? Math.max(0, Math.min(stacks, formula.maxStacks))
    : Math.max(0, stacks)
  return formula.formula(clampedStacks, level)
}
