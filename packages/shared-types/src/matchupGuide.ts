import type { BuildTag, ChampionRef, PatchStaleInfo, Role, StoredBuild } from './build'

export type MatchupGuideTag = Extract<BuildTag, 'pro' | 'otp'>

export type MatchupOutcomeKind = 'win' | 'lose' | 'skill' | 'even'

export type MatchupSkillFavor = 'self' | 'opponent' | 'even'

export type MatchupDifficultyBand = 'easy' | 'medium' | 'hard' | 'very_hard'

export type MatchupDifficultyMode = 'score' | 'band'

export type MatchupPhaseTag =
  | 'win'
  | 'lose'
  | 'skill'
  | 'even'
  | 'farm'
  | 'demand_gank'
  | 'aggressive'
  | 'passive'

export interface MatchupPhaseNotes {
  tags?: MatchupPhaseTag[]
  notes?: string
}

export type MatchupBuildVariantRef = 'main' | number

export interface MatchupBuildVariantPick {
  variant: MatchupBuildVariantRef
  /** Why this variant for this matchup (shown when several are selected). */
  reason?: string
}

export interface MatchupPowerSpike {
  /** Champion levels (1–18, or 1–20 top). */
  levels: number[]
  notes?: string
}

/** Per-opponent row (like a spreadsheet matchup line). */
export interface MatchupEntry {
  opponent: ChampionRef
  /** 1–10 difficulty score */
  difficultyScore?: number
  /** Easy → very hard (alternative to numeric score) */
  difficultyBand?: MatchupDifficultyBand
  difficultyMode?: MatchupDifficultyMode
  outcomeKind?: MatchupOutcomeKind
  /** When outcomeKind is skill — in whose favor */
  skillFavor?: MatchupSkillFavor
  /** Linked build variants from the guide build */
  buildVariants?: MatchupBuildVariantPick[]
  /** @deprecated use buildVariants */
  buildVariant?: MatchupBuildVariantRef
  powerSpike?: MatchupPowerSpike
  early?: MatchupPhaseNotes
  mid?: MatchupPhaseNotes
  late?: MatchupPhaseNotes
  /** Win / Lose / Skill — legacy free text */
  outcome?: string
  runes?: string
  itemPath?: string
  difficulty?: string
  comments?: string
}

/** Guide-level notes (permaban, general builds, socials…). */
export interface MatchupGuideMeta {
  shortDescription?: string
  permabanNotes?: string
  generalBuildNotes?: string
  authorAbout?: string
  opggUrl?: string
  socialLinks?: string[]
}

export interface MatchupGuide {
  id: string
  author?: string
  shortDescription?: string
  description?: string
  visibility?: 'public' | 'private'
  champion: ChampionRef | null
  role: Role
  tags?: MatchupGuideTag[]
  gameVersion: string
  createdAt: string
  updatedAt: string
  patchStale?: PatchStaleInfo | null
  build?: StoredBuild
  matchups?: MatchupEntry[]
  meta?: MatchupGuideMeta
  bestMatchups: ChampionRef[]
  worstMatchups: ChampionRef[]
}
