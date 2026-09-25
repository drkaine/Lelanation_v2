import type { RunesDetailPayload, SpellsDetailPayload } from '~/types/statisticsIndexPage'

type DetailPayload = RunesDetailPayload | SpellsDetailPayload | null | undefined

/** Runes part of an overview-detail payload, or null when the payload holds only summoner spells. */
export function runesDetail(data: DetailPayload): RunesDetailPayload | null {
  return data && 'runes' in data ? data : null
}

/** Summoner spells part of an overview-detail payload, or null when it holds only runes. */
export function spellsDetail(data: DetailPayload): SpellsDetailPayload | null {
  return data && 'summonerSpells' in data ? data : null
}
