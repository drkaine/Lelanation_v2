export type PatchChangeType = 'buff' | 'nerf' | 'adjust' | 'rework'

export interface PatchChange {
  stat: string
  old_value: string
  new_value: string
  type: PatchChangeType
  description_fr: string
  description_en: string
}

export interface PatchEntity {
  slug: string
  name_fr: string
  name_en: string
  image_url?: string
  ddragon_id: string
  global_type: PatchChangeType
  changes: PatchChange[]
}

export interface PatchHighlight {
  title_fr: string
  title_en: string
  image_url?: string
}

export interface PatchSkin {
  name_fr: string
  name_en: string
  champion: string
  image_url?: string
}

export interface PatchSystemSection {
  title_fr: string
  title_en: string
  content_fr: string
  content_en: string
}

export interface PatchNotesData {
  version: string
  date: string
  summary: { fr: string; en: string }
  highlights: PatchHighlight[]
  champions: PatchEntity[]
  items: PatchEntity[]
  runes: PatchEntity[]
  systems: PatchSystemSection[]
  skins: PatchSkin[]
}

export interface PatchNotesIndex {
  latest: string
  patches: string[]
}

export interface BuildCheckInput {
  champion_slug?: string
  champion_ddragon_id?: string
  items?: Array<{ slug?: string; ddragon_id?: string }>
  runes?: Array<{ slug?: string; ddragon_id?: string }>
  patch_created: string
}

export interface BuildAffectedEntry {
  entity_type: 'champion' | 'item' | 'rune'
  slug: string
  name_fr: string
  name_en: string
  ddragon_id: string
  global_type: PatchChangeType
  patch_version: string
  changes: PatchChange[]
}

export interface BuildCheckResult {
  score: number
  status: 'current' | 'affected' | 'outdated'
  affected: BuildAffectedEntry[]
  patches_since: number
}
