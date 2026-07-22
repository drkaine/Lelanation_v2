import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import * as cheerio from 'cheerio'

const MATCH_V5_DETAILS_URL = 'https://developer.riotgames.com/api-details/match-v5'
const CACHE_PATH = join(process.cwd(), 'data', 'api-riot', 'riot-portal-descriptions.json')

export type RiotPortalDescriptions = Record<string, string>

type FetchResult = {
  fetchedAt: string
  descriptions: RiotPortalDescriptions
}

function normalizeDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function parseDtoTables(html: string): RiotPortalDescriptions {
  const $ = cheerio.load(html)
  const out: RiotPortalDescriptions = {}

  $('h5[id]').each((_, heading) => {
    const id = $(heading).attr('id') ?? ''
    const dtoMatch = id.match(/1530-get(?:Match|Timeline)-([A-Za-z0-9]+)$/)
    if (!dtoMatch) return
    const dtoName = dtoMatch[1]

    const table = $(heading).nextAll('table.table').first()
    if (!table.length) return

    table.find('tbody tr').each((__, row) => {
      const cells = $(row).find('td')
      if (cells.length < 3) return
      const fieldName = normalizeDescription($(cells[0]).text())
      if (!fieldName || fieldName.includes(' ')) return
      const description = normalizeDescription($(cells[2]).text())
      out[`${dtoName}.${fieldName}`] = description
    })
  })

  return out
}

export async function fetchRiotPortalDescriptions(): Promise<RiotPortalDescriptions> {
  const res = await fetch(MATCH_V5_DETAILS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) {
    throw new Error(`Riot portal HTTP ${res.status}`)
  }
  const payload = (await res.json()) as { html?: string }
  if (!payload.html?.trim()) {
    throw new Error('Riot portal response missing html')
  }
  return parseDtoTables(payload.html)
}

export async function loadRiotPortalDescriptions(options?: {
  refresh?: boolean
}): Promise<RiotPortalDescriptions> {
  if (!options?.refresh) {
    try {
      const cached = await readFile(CACHE_PATH, 'utf-8')
      const parsed = JSON.parse(cached) as FetchResult
      if (parsed.descriptions && Object.keys(parsed.descriptions).length > 0) {
        return parsed.descriptions
      }
    } catch {
      // cache miss → fetch
    }
  }

  try {
    const descriptions = await fetchRiotPortalDescriptions()
    const payload: FetchResult = {
      fetchedAt: new Date().toISOString(),
      descriptions,
    }
    await writeFile(CACHE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
    return descriptions
  } catch (err) {
    try {
      const cached = await readFile(CACHE_PATH, 'utf-8')
      const parsed = JSON.parse(cached) as FetchResult
      if (parsed.descriptions) {
        console.warn('[registry] Riot portal fetch failed, using cached descriptions:', err)
        return parsed.descriptions
      }
    } catch {
      // no cache
    }
    throw err
  }
}

const MATCH_DTO_BY_SEGMENT: Record<string, string> = {
  metadata: 'MetadataDto',
  info: 'InfoDto',
  participants: 'ParticipantDto',
  teams: 'TeamDto',
  bans: 'BanDto',
  objectives: 'ObjectivesDto',
  challenges: 'ChallengesDto',
  perks: 'PerksDto',
  statPerks: 'PerkStatsDto',
  styles: 'PerkStyleDto',
  selections: 'PerkStyleSelectionDto',
  missions: 'MissionsDto',
  champion: 'ObjectiveDto',
  baron: 'ObjectiveDto',
  dragon: 'ObjectiveDto',
  horde: 'ObjectiveDto',
  inhibitor: 'ObjectiveDto',
  riftHerald: 'ObjectiveDto',
  tower: 'ObjectiveDto',
  PlayerBehavior: 'PlayerBehaviorDto',
}

const TIMELINE_DTO_BY_SEGMENT: Record<string, string> = {
  metadata: 'MetadataTimeLineDto',
  info: 'InfoTimeLineDto',
  frames: 'FramesTimeLineDto',
  events: 'EventsTimeLineDto',
  participantFrames: 'ParticipantFramesDto',
  championStats: 'ChampionStatsDto',
  damageStats: 'DamageStatsDto',
  position: 'PositionDto',
  participants: 'ParticipantTimeLineDto',
}

function dtoLookupKey(dto: string, field: string): string {
  return `${dto}.${field}`
}

function resolveDtoForPath(
  source: 'match' | 'timeline',
  segments: string[],
): { dto: string; field: string } | null {
  if (segments.length === 0) return null

  const map = source === 'match' ? MATCH_DTO_BY_SEGMENT : TIMELINE_DTO_BY_SEGMENT
  let dto = source === 'match' ? 'MatchDto' : 'TimelineDto'
  let i = 0

  if (segments[0] === 'metadata' || segments[0] === 'info') {
    dto = map[segments[0]] ?? dto
    i = 1
  }

  for (; i < segments.length - 1; i++) {
    const seg = segments[i].replace(/\[\]$/, '')
    if (!seg || seg === '*') {
      if (seg === '*' && dto === 'ParticipantFramesDto') dto = 'ParticipantFrameDto'
      continue
    }
    if (seg === 'participantFrames') {
      dto = 'ParticipantFrameDto'
      continue
    }
    const objectiveKeys = ['baron', 'champion', 'dragon', 'horde', 'inhibitor', 'riftHerald', 'tower']
    if (objectiveKeys.includes(seg)) {
      dto = 'ObjectiveDto'
      continue
    }
    if (map[seg]) {
      dto = map[seg]
    }
  }

  const field = segments[segments.length - 1]
  if (!field || field === '[]' || field === '*') return null
  return { dto, field }
}

export function lookupPortalDescription(
  source: 'match' | 'timeline',
  path: string,
  descriptions: RiotPortalDescriptions,
): string | null {
  const segments = path.split('.').filter(Boolean)
  const resolved = resolveDtoForPath(source, segments)
  if (!resolved) return null

  const direct = descriptions[dtoLookupKey(resolved.dto, resolved.field)]
  if (direct !== undefined) return direct

  // Team objectives: TeamDto.objectives → ObjectivesDto.baron → ObjectiveDto.kills
  if (resolved.dto === 'ObjectiveDto' && segments.length >= 2) {
    const parent = segments[segments.length - 2]
    if (['baron', 'champion', 'dragon', 'horde', 'inhibitor', 'riftHerald', 'tower'].includes(parent)) {
      return descriptions[dtoLookupKey('ObjectiveDto', resolved.field)] ?? null
    }
  }

  return null
}

export function fallbackDescription(
  source: 'match' | 'timeline',
  path: string,
  key: string,
  valueType: string,
): string {
  if (path.includes('PlayerBehavior')) {
    return `Comportement joueur (non documenté officiellement) — ${key}.`
  }
  if (/PlayerScore\d+/i.test(key)) {
    return `Score interne Riot (non documenté officiellement) — ${key}.`
  }
  if (path.includes('metadata.')) {
    return `Métadonnées ${source === 'match' ? 'match' : 'timeline'} — ${key}.`
  }
  if (path.includes('participants[]') && path.includes('challenges.')) {
    return `Indicateur challenge Riot (ParticipantDto.challenges) — ${key}.`
  }
  if (path.includes('participants[]')) {
    return `Statistique participant fin de partie — ${key}.`
  }
  if (path.includes('teams[]')) {
    return `Statistique équipe fin de partie — ${key}.`
  }
  if (path.includes('frames[].events[]')) {
    return `Événement timeline — ${key}${key === 'type' ? ' (type d’événement)' : ''}.`
  }
  if (path.includes('participantFrames.*.championStats.')) {
    return `Stat champion instantanée (frame timeline) — ${key}.`
  }
  if (path.includes('participantFrames.*.damageStats.')) {
    return `Dégâts cumulés instantanés (frame timeline) — ${key}.`
  }
  if (path.includes('participantFrames.*')) {
    return `État participant à un instant T (frame timeline) — ${key}.`
  }
  if (path.includes('frames[]') && key === 'timestamp') {
    return 'Horodatage relatif de la frame timeline (ms depuis le début).'
  }
  if (source === 'match' && path.startsWith('info.')) {
    return `Champ match (InfoDto) — ${key}.`
  }
  if (source === 'timeline' && path.startsWith('info.')) {
    return `Champ timeline (InfoTimeLineDto) — ${key}.`
  }
  return `${key} (${valueType}).`
}

export function resolveFieldDescription(
  source: 'match' | 'timeline',
  path: string,
  key: string,
  valueType: string,
  descriptions: RiotPortalDescriptions,
): string {
  const official = lookupPortalDescription(source, path, descriptions)
  if (official && official.length > 0) return official
  return fallbackDescription(source, path, key, valueType)
}
