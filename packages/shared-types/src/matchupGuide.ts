import type { BuildTag, ChampionRef, PatchStaleInfo, Role } from './build'

export type MatchupGuideTag = Extract<BuildTag, 'pro' | 'otp'>

export interface MatchupGuide {
  id: string
  author?: string
  description?: string
  visibility?: 'public' | 'private'
  champion: ChampionRef | null
  role: Role
  tags?: MatchupGuideTag[]
  /** Patch de la dernière modification du guide */
  gameVersion: string
  createdAt: string
  updatedAt: string
  patchStale?: PatchStaleInfo | null
  bestMatchups: ChampionRef[]
  worstMatchups: ChampionRef[]
}
