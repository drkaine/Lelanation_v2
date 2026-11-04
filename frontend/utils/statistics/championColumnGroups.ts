export type ChampionColumnGroup = 'heal' | 'dealt' | 'taken'
export type ChampionColumnMode = 'all' | ChampionColumnGroup
export type ChampionColumnFlags = Record<ChampionColumnGroup, boolean>

export const CHAMPION_COLUMN_MODES: ChampionColumnMode[] = ['all', 'heal', 'dealt', 'taken']

/** Sélecteur de groupe de colonnes (maquette Champion) : un seul groupe ou tout. */
export function championColumnFlags(mode: ChampionColumnMode): ChampionColumnFlags {
  if (mode === 'all') return { heal: true, dealt: true, taken: true }
  return { heal: mode === 'heal', dealt: mode === 'dealt', taken: mode === 'taken' }
}

export function championColumnMode(flags: ChampionColumnFlags): ChampionColumnMode | null {
  const on = (Object.keys(flags) as ChampionColumnGroup[]).filter(k => flags[k])
  if (on.length === 3) return 'all'
  if (on.length === 1) return on[0]!
  return null
}
