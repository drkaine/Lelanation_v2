import type {
  Build,
  ChampionRef,
  MatchupGuide,
  MatchupGuideTag,
  Role,
} from '@lelanation/shared-types'
import {
  MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX,
  truncateMatchupGuideText,
} from '~/utils/matchupGuideText'

export function championToRef(champion: {
  id: string
  name: string
  image: { full: string }
}): ChampionRef {
  return {
    id: champion.id,
    name: champion.name,
    image: { full: champion.image.full },
  }
}

export function buildMatchupGuideFromDraft(
  build: Build,
  rankedOpponents: ChampionRef[],
  guideId: string
): MatchupGuide {
  const now = new Date().toISOString()
  const description = build.description?.trim() ?? ''
  const role = (build.roles?.[0] ?? 'mid') as Role
  const tags = (build.tags ?? []).filter(
    (tag): tag is MatchupGuideTag => tag === 'pro' || tag === 'otp'
  )

  const bestMatchups = rankedOpponents.slice(0, 3)
  const worstMatchups = [...rankedOpponents].slice(-3).reverse()

  return {
    id: guideId,
    author: build.author,
    shortDescription: description
      ? truncateMatchupGuideText(description, MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX)
      : undefined,
    description: description || undefined,
    visibility: build.visibility ?? 'public',
    champion: build.champion ? championToRef(build.champion) : null,
    role,
    tags: tags.length > 0 ? tags : undefined,
    gameVersion: build.gameVersion,
    createdAt: now,
    updatedAt: now,
    patchStale: null,
    bestMatchups,
    worstMatchups,
  }
}
