import type {
  Build,
  ChampionRef,
  MatchupEntry,
  MatchupGuide,
  MatchupGuideMeta,
  MatchupGuideTag,
  Role,
} from '@lelanation/shared-types'
import { serializeBuild } from '~/utils/buildSerialize'
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

export function createEmptyMatchupEntry(opponent: ChampionRef): MatchupEntry {
  return { opponent }
}

export function deriveBestWorstFromMatchups(matchups: MatchupEntry[]): {
  bestMatchups: ChampionRef[]
  worstMatchups: ChampionRef[]
} {
  const opponents = matchups.map(entry => entry.opponent)
  return {
    bestMatchups: opponents.slice(0, 3),
    worstMatchups: [...opponents].slice(-3).reverse(),
  }
}

export function buildMatchupGuideFromDraft(
  build: Build,
  matchups: MatchupEntry[],
  guideId: string,
  meta?: MatchupGuideMeta
): MatchupGuide {
  const now = new Date().toISOString()
  const description = build.description?.trim() ?? ''
  const shortDescription = meta?.shortDescription?.trim() ?? ''
  const role = (build.roles?.[0] ?? 'mid') as Role
  const tags = (build.tags ?? []).filter(
    (tag): tag is MatchupGuideTag => tag === 'pro' || tag === 'otp'
  )
  const { bestMatchups, worstMatchups } = deriveBestWorstFromMatchups(matchups)
  const visibility = build.visibility ?? 'public'
  const buildSnapshot = serializeBuild({ ...build, visibility, matchupGuideEmbed: true })

  return {
    id: guideId,
    author: build.author,
    shortDescription: shortDescription
      ? truncateMatchupGuideText(shortDescription, MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX)
      : undefined,
    description: description || undefined,
    visibility,
    champion: build.champion ? championToRef(build.champion) : null,
    role,
    tags: tags.length > 0 ? tags : undefined,
    gameVersion: build.gameVersion,
    createdAt: now,
    updatedAt: now,
    patchStale: null,
    buildId: build.id,
    ...(visibility === 'private' ? { build: buildSnapshot } : {}),
    matchups,
    meta: meta && Object.values(meta).some(Boolean) ? meta : undefined,
    bestMatchups,
    worstMatchups,
  }
}
