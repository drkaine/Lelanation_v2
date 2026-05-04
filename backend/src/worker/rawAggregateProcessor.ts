import { prisma } from '../db.js'
import type { MatchIngestQueuePayloadV1 } from './matchIngestQueue.js'
import { createHash } from 'node:crypto'
import { selectMatchPlayerItems } from './itemBuildSelection.js'

const STARTER_SET_EXCLUDED_ITEM_IDS = new Set([
  3340, 3364, 3363, 2055,
  2003, 2009, 2010, 2031, 2032, 2033, 2060,
  2138, 2139, 2140,
])

/** Prisma interactive transaction default is 5s; raw aggregate does many upserts and can exceed that under load/backfill. */
function rawAggregateTransactionOptions(): { maxWait: number; timeout: number } {
  const timeout = Math.max(
    10_000,
    Math.min(3_600_000, Number(process.env.RAW_AGGREGATE_TX_TIMEOUT_MS ?? 300_000))
  )
  return { maxWait: 60_000, timeout }
}

type RawParticipant = {
  puuid?: string
  riotIdGameName?: string
  riotIdName?: string
  riotIdTagline?: string
  riotIdTagLine?: string
  participantId?: number
  championId?: number
  teamId?: number
  teamPosition?: string
  individualPosition?: string
  win?: boolean
  kills?: number
  deaths?: number
  assists?: number
  totalDamageDealtToChampions?: number
  physicalDamageDealtToChampions?: number
  magicDamageDealtToChampions?: number
  trueDamageDealtToChampions?: number
  tier?: string
  rankTier?: string
  rank?: string
  rankDivision?: string
  summoner1Id?: number
  summoner2Id?: number
  runes?: number[]
  shards?: number[]
  perks?: {
    styles?: Array<{ style?: number; selections?: Array<{ perk?: number }> }>
    statPerks?: { offense?: number; flex?: number; defense?: number }
  }
  item0?: number
  item1?: number
  item2?: number
  item3?: number
  item4?: number
  item5?: number
  spell1Casts?: number
  spell2Casts?: number
  spell3Casts?: number
  spell4Casts?: number
  spellOrder?: number[]
  skillOrder?: number[]
}

type RawTeam = {
  teamId?: number
  win?: boolean
  bans?: Array<{ championId?: number; pickOrder?: number; pickTurn?: number }>
  objectives?: Record<string, { first?: boolean; kills?: number }>
}

type TimelineEvent = {
  type?: string
  killerTeamId?: number
  teamId?: number
  monsterType?: string
  monsterSubType?: string
  name?: string
}

type TeamDrakeObjectiveStats = {
  earthDrake: number
  waterDrake: number
  windDrake: number
  fireDrake: number
  hextecDrake: number
  chemDrake: number
  earthSoul: number
  waterSoul: number
  windSoul: number
  fireSoul: number
  hextecSoul: number
  chemSoul: number
  elderKills: number
}

function toSafeInt(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return 0
}

function readParticipantMetricInt(
  participant: RawParticipant,
  key: string,
  challengeKey?: string
): number {
  const p = participant as unknown as Record<string, unknown>
  const direct = toSafeInt(p[key])
  if (direct !== 0) return direct
  const challenges = p.challenges as Record<string, unknown> | undefined
  if (!challenges) return 0
  return toSafeInt(challenges[challengeKey ?? key])
}

function readParticipantMetricNumber(
  participant: RawParticipant,
  key: string,
  challengeKey?: string
): number {
  const p = participant as unknown as Record<string, unknown>
  const directRaw = p[key]
  if (typeof directRaw === 'boolean') return directRaw ? 1 : 0
  const direct = toSafeInt(directRaw)
  if (direct !== 0) return direct
  const challenges = p.challenges as Record<string, unknown> | undefined
  if (!challenges) return 0
  const cRaw = challenges[challengeKey ?? key]
  if (typeof cRaw === 'boolean') return cRaw ? 1 : 0
  return toSafeInt(cRaw)
}

function normalizeRankTier(p: RawParticipant): string {
  const raw = (p.tier ?? p.rankTier ?? 'UNRANKED').toString().trim().toUpperCase()
  if (!raw || raw === 'UNRANKED') return 'UNRANKED'
  return raw.split('_')[0] || 'UNRANKED'
}

function normalizeRankDivision(p: RawParticipant): string | null {
  const raw = (p.rank ?? p.rankDivision ?? '').toString().trim().toUpperCase()
  if (!raw || raw === 'UNRANKED') return null
  return raw
}

function participantRiotId(p: RawParticipant): { gameName: string | null; tagName: string | null } {
  const gameNameRaw = (p.riotIdGameName ?? p.riotIdName ?? '').toString().trim()
  const tagNameRaw = (p.riotIdTagline ?? p.riotIdTagLine ?? '').toString().trim()
  return {
    gameName: gameNameRaw.length > 0 ? gameNameRaw : null,
    tagName: tagNameRaw.length > 0 ? tagNameRaw : null,
  }
}

/** Same default as `ingestMatchLean.ts` (`upsertIngestMatchAndParticipants`). */
function normalizePuuidKeyVersion(puuidKeyVersion: string | null): string {
  return typeof puuidKeyVersion === 'string' && puuidKeyVersion.trim() !== ''
    ? puuidKeyVersion.trim()
    : 'perso'
}

function buildTrackedPlayersPayload(
  participants: RawParticipant[],
  region: string
): Array<Record<string, unknown> | null> {
  const slots: Array<Record<string, unknown> | null> = Array.from({ length: 10 }, () => null)
  for (let i = 0; i < Math.min(10, participants.length); i++) {
    const p = participants[i]
    const { gameName, tagName } = participantRiotId(p)
    const puuid = String(p.puuid ?? '').trim()
    slots[i] = {
      puuid: puuid.length > 0 ? puuid : null,
      gameName,
      tagName,
      region,
      rankTier: normalizeRankTier(p),
      rankDivision: normalizeRankDivision(p),
    }
  }
  return slots
}

async function upsertPlayersFromRawParticipants(
  tx: any,
  participants: RawParticipant[],
  region: string,
  gameDate: Date | null,
  puuidKeyVersion: string | null
): Promise<void> {
  const normalizedPuuidKeyVersion = normalizePuuidKeyVersion(puuidKeyVersion)
  const apexNoDivisionTiers = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER'])
  const puuidsForKeyBackfill: string[] = []
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? '').trim()
    if (!puuid) continue
    puuidsForKeyBackfill.push(puuid)
    const rankTier = normalizeRankTier(participant)
    const rankDivision = normalizeRankDivision(participant)
    const { gameName, tagName } = participantRiotId(participant)
    const dataUpdate: Record<string, unknown> = {
      region,
      lastSeen: gameDate ?? new Date(),
      gameName,
      tagName,
    }
    if (rankTier !== 'UNRANKED') {
      dataUpdate['rankTier'] = rankTier
      // Keep existing division if incoming payload only carries tier.
      // Explicitly persist NULL only for apex tiers that do not have divisions.
      if (rankDivision != null || apexNoDivisionTiers.has(rankTier)) {
        dataUpdate['rankDivision'] = rankDivision
      }
      dataUpdate['rankSnapshotGameDate'] = gameDate ?? new Date()
    }
    await tx.player.upsert({
      where: { puuid },
      create: {
        puuid,
        region,
        puuidKeyVersion: normalizedPuuidKeyVersion,
        gameName,
        tagName,
        lastSeen: gameDate ?? new Date(),
        rankTier: rankTier === 'UNRANKED' ? null : rankTier,
        rankDivision: rankTier === 'UNRANKED' ? null : rankDivision,
        rankSnapshotGameDate: rankTier === 'UNRANKED' ? null : gameDate ?? new Date(),
      },
      update: dataUpdate,
    })
  }
  if (normalizedPuuidKeyVersion && puuidsForKeyBackfill.length > 0) {
    await tx.player.updateMany({
      where: {
        puuid: { in: puuidsForKeyBackfill },
        OR: [
          { puuidKeyVersion: null },
          { puuidKeyVersion: '' },
          { puuidKeyVersion: 'perdu' },
        ],
      },
      data: { puuidKeyVersion: normalizedPuuidKeyVersion },
    })
  }
}

function normalizeGameVersion(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return 'unknown'
  const [major, minor] = s.split('.')
  if (!major || !minor) return s
  return `${major}.${minor}`
}

async function loadPlayerRankTiersByPuuid(puuids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(
    new Set(
      puuids
        .map((v) => String(v ?? '').trim())
        .filter((v) => v.length > 0)
    )
  )
  if (uniq.length === 0) return new Map<string, string>()
  const rows = await prisma.player.findMany({
    where: { puuid: { in: uniq } },
    select: { puuid: true, rankTier: true },
  })
  const m = new Map<string, string>()
  for (const r of rows) {
    const pu = String(r.puuid ?? '').trim().toLowerCase()
    const tier = String(r.rankTier ?? 'UNRANKED').trim().toUpperCase()
    if (pu) m.set(pu, tier)
  }
  return m
}

async function loadTrackedMatchRankTiersByPuuid(trackedMatchId: string): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<
    Array<{
      player1: unknown | null
      player2: unknown | null
      player3: unknown | null
      player4: unknown | null
      player5: unknown | null
      player6: unknown | null
      player7: unknown | null
      player8: unknown | null
      player9: unknown | null
      player10: unknown | null
    }>
  >`
    SELECT
      player1, player2, player3, player4, player5,
      player6, player7, player8, player9, player10
    FROM tracked_matches
    WHERE match_id = ${trackedMatchId}
    LIMIT 1
  `
  const out = new Map<string, string>()
  const row = rows[0]
  if (!row) return out
  const slots = [
    row.player1,
    row.player2,
    row.player3,
    row.player4,
    row.player5,
    row.player6,
    row.player7,
    row.player8,
    row.player9,
    row.player10,
  ]
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) continue
    const rec = slot as Record<string, unknown>
    const puuid = String(rec['puuid'] ?? '').trim().toLowerCase()
    if (!puuid) continue
    const rankTier = String(rec['rankTier'] ?? '').trim().toUpperCase()
    if (!rankTier) continue
    out.set(puuid, rankTier)
  }
  return out
}

function ensureTrackedRanksPresentForParticipants(
  participants: RawParticipant[],
  trackedRankByPuuid: Map<string, string>
): boolean {
  for (const p of participants) {
    const puuid = String(p.puuid ?? '').trim().toLowerCase()
    if (!puuid) continue
    const rankTier = trackedRankByPuuid.get(puuid)
    if (!rankTier || rankTier.length === 0) return false
  }
  return true
}

function mergeParticipantTiersFromDb(
  parts: RawParticipant[],
  dbRankByPuuid: Map<string, string>
): RawParticipant[] {
  return parts.map((p) => {
    const pid = String(p.puuid ?? '').trim().toLowerCase()
    if (!pid) return p
    const dbTier = dbRankByPuuid.get(pid)
    if (!dbTier || dbTier === 'UNRANKED') return p
    if (normalizeRankTier(p) !== 'UNRANKED') return p
    return { ...p, tier: dbTier }
  })
}

function roleFromPosition(p: RawParticipant): string {
  const pos = String(p.teamPosition ?? p.individualPosition ?? '').trim().toUpperCase()
  if (!pos) return 'FILL'
  if (pos === 'MID') return 'MIDDLE'
  if (pos === 'ADC') return 'BOTTOM'
  if (pos === 'UTILITY') return 'SUPPORT'
  return pos
}

function isAllowedRole(role: string): boolean {
  return role === 'TOP' || role === 'JUNGLE' || role === 'MIDDLE' || role === 'BOTTOM' || role === 'SUPPORT'
}

function resolveParticipantRoles(participants: RawParticipant[]): string[] {
  const roles = participants.map((p) => roleFromPosition(p))
  const allowedRoles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT']
  const byTeam = new Map<number, number[]>()

  for (let i = 0; i < participants.length; i++) {
    const teamId = toSafeInt(participants[i]?.teamId)
    if (teamId !== 100 && teamId !== 200) continue
    const list = byTeam.get(teamId) ?? []
    list.push(i)
    byTeam.set(teamId, list)
  }

  for (const indices of byTeam.values()) {
    const present = new Set<string>()
    const unknownIndices: number[] = []

    for (const idx of indices) {
      const role = roles[idx] ?? 'FILL'
      if (isAllowedRole(role)) present.add(role)
      else unknownIndices.push(idx)
    }

    if (unknownIndices.length !== 1) continue
    const missing = allowedRoles.filter((r) => !present.has(r))
    if (missing.length !== 1) continue
    roles[unknownIndices[0]] = missing[0]
  }

  return roles
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function readParticipantBoolTrue(
  participant: RawParticipant,
  key: string,
  challengeKey?: string
): number {
  const p = participant as unknown as Record<string, unknown>
  const direct = p[key]
  if (typeof direct === 'boolean') return direct ? 1 : 0
  const challenges = p.challenges as Record<string, unknown> | undefined
  const v = challenges?.[challengeKey ?? key]
  if (typeof v === 'boolean') return v ? 1 : 0
  const n = toSafeInt(v)
  return n > 0 ? 1 : 0
}

function readParticipantBoolFalse(
  participant: RawParticipant,
  key: string,
  challengeKey?: string
): number {
  return readParticipantBoolTrue(participant, key, challengeKey) > 0 ? 0 : 1
}

function snakeToCamel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, m: string) => m.toUpperCase())
}

let participantAggColumnsPromise: Promise<string[]> | null = null
async function getParticipantAggColumns(): Promise<string[]> {
  if (!participantAggColumnsPromise) {
    participantAggColumnsPromise = prisma
      .$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'agg_champion_participant_stats'
          AND column_name NOT IN ('champion_stat_id', 'updated_at')
        ORDER BY ordinal_position
      `
      .then((rows) => rows.map((r) => String(r.column_name)))
  }
  return participantAggColumnsPromise
}

function participantValueForAggColumn(participant: RawParticipant, column: string): number {
  if (column.startsWith('sum_')) {
    const metricKey = snakeToCamel(column.slice(4))
    return readParticipantMetricNumber(participant, metricKey)
  }
  if (column.startsWith('count_') && column.endsWith('_true')) {
    const metricKey = snakeToCamel(column.slice(6, -5))
    return readParticipantBoolTrue(participant, metricKey)
  }
  if (column.startsWith('count_') && column.endsWith('_false')) {
    const metricKey = snakeToCamel(column.slice(6, -6))
    return readParticipantBoolFalse(participant, metricKey)
  }
  if (column.startsWith('count_')) {
    const metricKey = snakeToCamel(column.slice(6))
    return readParticipantMetricNumber(participant, metricKey)
  }
  return 0
}


function coreStatId(
  championId: number,
  role: string,
  rankTier: string,
  gameVersion: string,
  region: string
): bigint {
  const key = `${championId}|${role}|${rankTier}|${gameVersion}|${region}`
  const digest = createHash('sha256').update(key).digest('hex')
  const asBigInt = BigInt(`0x${digest.slice(0, 16)}`)
  return asBigInt & BigInt('0x7fffffffffffffff')
}

function teamCoreId(team: number, rankTier: string, gameVersion: string): bigint {
  const key = `${team}|${rankTier}|${gameVersion}`
  const digest = createHash('sha256').update(key).digest('hex')
  const asBigInt = BigInt(`0x${digest.slice(0, 16)}`)
  return asBigInt & BigInt('0x7fffffffffffffff')
}

function toObjectiveBucket(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(20, Math.max(0, Math.trunc(value)))
}

function extractRunesAndShards(p: RawParticipant): { runes: number[]; shards: number[]; stylesByRune: Map<number, string> } {
  const stylesByRune = new Map<number, string>()
  const runesFromFlat = Array.isArray(p.runes) ? p.runes.map((x) => toSafeInt(x)).filter((x) => x > 0) : []
  const shardsFromFlat = Array.isArray(p.shards) ? p.shards.map((x) => toSafeInt(x)).filter((x) => x > 0) : []

  const perks = p.perks
  const runesFromPerks: number[] = []
  if (Array.isArray(perks?.styles)) {
    for (const st of perks.styles) {
      const styleStr = String(toSafeInt(st?.style))
      for (const sel of st?.selections ?? []) {
        const perkId = toSafeInt(sel?.perk)
        if (perkId > 0) {
          runesFromPerks.push(perkId)
          stylesByRune.set(perkId, styleStr)
        }
      }
    }
  }

  const statPerks = perks?.statPerks
  const shardsFromPerks = [toSafeInt(statPerks?.offense), toSafeInt(statPerks?.flex), toSafeInt(statPerks?.defense)].filter((x) => x > 0)

  const runes = (runesFromFlat.length > 0 ? runesFromFlat : runesFromPerks).filter((x) => x > 0)
  const shards = (shardsFromFlat.length > 0 ? shardsFromFlat : shardsFromPerks).filter((x) => x > 0)
  return { runes, shards, stylesByRune }
}

function extractFinalItems(p: RawParticipant): number[] {
  const ids = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5]
    .map((v) => toSafeInt(v))
    .filter((v) => v > 0)
  return ids
}

function extractTimelineItemEvents(payload: MatchIngestQueuePayloadV1): Array<{
  type: string
  timestamp?: number
  participantId?: number
  itemId?: number
  beforeId?: number
  afterId?: number
}> {
  const timeline = payload.timelineDto as
    | {
        info?: {
          frames?: Array<{
            events?: Array<Record<string, unknown>>
          }>
        }
      }
    | null
  const frames = timeline?.info?.frames
  if (!Array.isArray(frames)) return []
  const out: Array<{
    type: string
    timestamp?: number
    participantId?: number
    itemId?: number
    beforeId?: number
    afterId?: number
  }> = []
  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      out.push({
        type: String(ev?.type ?? ''),
        timestamp: toSafeInt(ev?.timestamp),
        participantId: toSafeInt(ev?.participantId),
        itemId: toSafeInt(ev?.itemId),
        beforeId: toSafeInt(ev?.beforeId),
        afterId: toSafeInt(ev?.afterId),
      })
    }
  }
  return out
}

function extractSpellOrder(p: RawParticipant): number[] {
  const raw = (p.spellOrder ?? p.skillOrder ?? []) as unknown
  if (!Array.isArray(raw)) return []
  return raw.map((v) => toSafeInt(v)).filter((v) => v >= 1 && v <= 4).slice(0, 18)
}

function extractTimelineSpellOrdersByParticipant(payload: MatchIngestQueuePayloadV1): Map<number, number[]> {
  const out = new Map<number, number[]>()
  const timeline = payload.timelineDto as
    | {
        info?: {
          frames?: Array<{
            events?: Array<{
              type?: string
              participantId?: number
              skillSlot?: number
            }>
          }>
        }
      }
    | null
  const frames = timeline?.info?.frames
  if (!Array.isArray(frames)) return out

  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      if (String(ev?.type ?? '').trim().toUpperCase() !== 'SKILL_LEVEL_UP') continue
      const participantId = toSafeInt(ev?.participantId)
      const skillSlot = toSafeInt(ev?.skillSlot)
      if (participantId <= 0 || skillSlot < 1 || skillSlot > 4) continue
      const prev = out.get(participantId) ?? []
      prev.push(skillSlot)
      out.set(participantId, prev.slice(0, 18))
    }
  }

  return out
}

function toDurationBucket(gameDurationSeconds: number): number {
  if (!Number.isFinite(gameDurationSeconds) || gameDurationSeconds <= 0) return 0
  return Math.max(0, Math.trunc(gameDurationSeconds / 60))
}

function bannerRoleFromPickOrder(pickOrderRaw: unknown): string {
  const pickOrder = toSafeInt(pickOrderRaw)
  if (pickOrder <= 0) return 'UNKNOWN'
  const normalized = ((pickOrder - 1) % 5) + 1
  if (normalized === 1) return 'TOP'
  if (normalized === 2) return 'JUNGLE'
  if (normalized === 3) return 'MIDDLE'
  if (normalized === 4) return 'BOTTOM'
  if (normalized === 5) return 'SUPPORT'
  return 'UNKNOWN'
}

function isRetryableTxError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('40P01') || message.toLowerCase().includes('deadlock detected')
}

type SpellOrderAggEntry = {
  order: number[]
  number_of_games: number
  number_of_wins: number
}

function parseSpellOrderMap(raw: unknown): Record<string, SpellOrderAggEntry> {
  if (!isPlainObject(raw)) return {}
  const out: Record<string, SpellOrderAggEntry> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!isPlainObject(v)) continue
    const order = Array.isArray(v.order) ? v.order.map((x) => toSafeInt(x)).filter((x) => x >= 1 && x <= 4) : []
    const number_of_games = toSafeInt(v.number_of_games)
    const number_of_wins = toSafeInt(v.number_of_wins)
    out[k] = { order, number_of_games, number_of_wins }
  }
  return out
}

function initTeamDrakeStats(): TeamDrakeObjectiveStats {
  return {
    earthDrake: 0,
    waterDrake: 0,
    windDrake: 0,
    fireDrake: 0,
    hextecDrake: 0,
    chemDrake: 0,
    earthSoul: 0,
    waterSoul: 0,
    windSoul: 0,
    fireSoul: 0,
    hextecSoul: 0,
    chemSoul: 0,
    elderKills: 0,
  }
}

function normalizeDragonElement(raw: unknown): 'earth' | 'water' | 'wind' | 'fire' | 'hextec' | 'chem' | null {
  const v = String(raw ?? '').trim().toUpperCase()
  if (!v) return null
  if (v.includes('MOUNTAIN') || v.includes('EARTH')) return 'earth'
  if (v.includes('OCEAN') || v.includes('WATER')) return 'water'
  if (v.includes('CLOUD') || v.includes('WIND') || v.includes('AIR')) return 'wind'
  if (v.includes('INFERNAL') || v.includes('FIRE')) return 'fire'
  if (v.includes('HEXTECH') || v.includes('HEXTEC')) return 'hextec'
  if (v.includes('CHEMTECH') || v.includes('CHEM')) return 'chem'
  return null
}

function addDrakeKill(stats: TeamDrakeObjectiveStats, element: NonNullable<ReturnType<typeof normalizeDragonElement>>): void {
  if (element === 'earth') stats.earthDrake++
  else if (element === 'water') stats.waterDrake++
  else if (element === 'wind') stats.windDrake++
  else if (element === 'fire') stats.fireDrake++
  else if (element === 'hextec') stats.hextecDrake++
  else if (element === 'chem') stats.chemDrake++
}

function markSoul(stats: TeamDrakeObjectiveStats, element: NonNullable<ReturnType<typeof normalizeDragonElement>>): void {
  if (element === 'earth') stats.earthSoul = 1
  else if (element === 'water') stats.waterSoul = 1
  else if (element === 'wind') stats.windSoul = 1
  else if (element === 'fire') stats.fireSoul = 1
  else if (element === 'hextec') stats.hextecSoul = 1
  else if (element === 'chem') stats.chemSoul = 1
}

function extractTeamDrakeStatsByTeam(payload: MatchIngestQueuePayloadV1): Map<number, TeamDrakeObjectiveStats> {
  const out = new Map<number, TeamDrakeObjectiveStats>()
  const timeline = payload.timelineDto as { info?: { frames?: Array<{ events?: TimelineEvent[] }> } } | null
  const frames = timeline?.info?.frames
  if (!Array.isArray(frames)) return out

  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      const evType = String(ev?.type ?? '').trim().toUpperCase()
      if (!evType) continue

      if (evType === 'ELITE_MONSTER_KILL') {
        const killerTeamId = toSafeInt(ev?.killerTeamId)
        if (killerTeamId !== 100 && killerTeamId !== 200) continue
        const teamStats = out.get(killerTeamId) ?? initTeamDrakeStats()
        const monsterType = String(ev?.monsterType ?? '').trim().toUpperCase()
        if (monsterType === 'DRAGON') {
          const subtype = String(ev?.monsterSubType ?? '').trim().toUpperCase()
          if (subtype.includes('ELDER')) {
            teamStats.elderKills++
          } else {
            const element = normalizeDragonElement(subtype)
            if (element) addDrakeKill(teamStats, element)
          }
        } else if (monsterType.includes('ELDER')) {
          teamStats.elderKills++
        }
        out.set(killerTeamId, teamStats)
        continue
      }

      if (evType === 'DRAGON_SOUL_GIVEN') {
        const soulTeamId = toSafeInt(ev?.teamId)
        if (soulTeamId !== 100 && soulTeamId !== 200) continue
        const teamStats = out.get(soulTeamId) ?? initTeamDrakeStats()
        const element = normalizeDragonElement(ev?.name)
        if (element) markSoul(teamStats, element)
        out.set(soulTeamId, teamStats)
      }
    }
  }

  return out
}

function extractFirstInhibitorTeamId(payload: MatchIngestQueuePayloadV1): number | null {
  const timeline = payload.timelineDto as { info?: { frames?: Array<{ events?: TimelineEvent[] }> } } | null
  const frames = timeline?.info?.frames
  if (!Array.isArray(frames)) return null
  for (const frame of frames) {
    for (const ev of frame.events ?? []) {
      const evType = String(ev?.type ?? '').trim().toUpperCase()
      if (evType !== 'BUILDING_KILL') continue
      const buildingType = String((ev as { buildingType?: unknown })?.buildingType ?? '')
        .trim()
        .toUpperCase()
      if (buildingType !== 'INHIBITOR_BUILDING') continue
      const killerTeamId = toSafeInt((ev as { killerTeamId?: unknown })?.killerTeamId)
      if (killerTeamId === 100 || killerTeamId === 200) return killerTeamId
      const destroyedTeamId = toSafeInt((ev as { teamId?: unknown })?.teamId)
      if (destroyedTeamId === 100) return 200
      if (destroyedTeamId === 200) return 100
      return null
    }
  }
  return null
}

export async function processRawAggregateAndBurn(
  rawId: bigint,
  payload: MatchIngestQueuePayloadV1,
  trackedMatchId: string
): Promise<void> {
  const dto = payload.matchDto as { info?: { participants?: RawParticipant[] } }
  const participants = dto?.info?.participants
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('invalid_raw_payload_shape')
  }

  const infoAny = payload.matchDto as {
    info?: {
      gameVersion?: string
      gameDuration?: number
      teams?: RawTeam[]
    }
  }
  const gameVersion = normalizeGameVersion(infoAny.info?.gameVersion)
  const gameStartTs = toSafeInt((infoAny.info as { gameStartTimestamp?: unknown } | undefined)?.gameStartTimestamp)
  const gameDate = gameStartTs > 0 ? new Date(gameStartTs) : null
  const durationBucket = toDurationBucket(toSafeInt(infoAny.info?.gameDuration))
  const region = String(payload.region ?? '').trim().toLowerCase() || 'euw1'
  const bannedChampions = new Set<number>()
  for (const team of infoAny.info?.teams ?? []) {
    for (const ban of team.bans ?? []) {
      const bid = toSafeInt(ban.championId)
      if (bid > 0) bannedChampions.add(bid)
    }
  }

  const dbRankByPuuid = await loadPlayerRankTiersByPuuid(
    participants.map((p) => String(p.puuid ?? '')).filter((p) => p.length > 0)
  )
  const trackedRankByPuuid = await loadTrackedMatchRankTiersByPuuid(trackedMatchId)
  if (!ensureTrackedRanksPresentForParticipants(participants, trackedRankByPuuid)) {
    throw new Error('tracked_rank_pending')
  }
  const participantsForAgg = mergeParticipantTiersFromDb(
    mergeParticipantTiersFromDb(participants, trackedRankByPuuid),
    dbRankByPuuid
  )
  const trackedPlayerSlots = buildTrackedPlayersPayload(participantsForAgg, region)
  const timelineSpellOrdersByParticipant = extractTimelineSpellOrdersByParticipant(payload)
  const timelineItemEvents = extractTimelineItemEvents(payload)
  const drakeStatsByTeam = extractTeamDrakeStatsByTeam(payload)
  const firstInhibitorTeamId = extractFirstInhibitorTeamId(payload)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
    await upsertPlayersFromRawParticipants(tx, participantsForAgg, region, gameDate, payload.puuidKeyVersion)
    const resolvedRoles = resolveParticipantRoles(participantsForAgg)
    const participantByTeamRole = new Map<string, RawParticipant[]>()
    const teamRoleByChampion = new Map<string, string>()
    for (let idx = 0; idx < participantsForAgg.length; idx++) {
      const p = participantsForAgg[idx]
      const teamId = toSafeInt(p.teamId)
      const role = resolvedRoles[idx] ?? roleFromPosition(p)
      const key = `${teamId}|${role}`
      const list = participantByTeamRole.get(key) ?? []
      list.push(p)
      participantByTeamRole.set(key, list)
      const championId = toSafeInt(p.championId)
      if (championId > 0 && (teamId === 100 || teamId === 200) && role !== 'FILL') {
        teamRoleByChampion.set(`${teamId}|${championId}`, role)
      }
    }

    for (let idx = 0; idx < participantsForAgg.length; idx++) {
      const p = participantsForAgg[idx]
      const championId = toSafeInt(p.championId)
      if (championId <= 0) continue

      const wins = p.win === true ? 1 : 0
      const rankTier = normalizeRankTier(p)
      if (rankTier === 'UNRANKED') continue
      const role = resolvedRoles[idx] ?? roleFromPosition(p)
      if (!isAllowedRole(role)) continue
      const statIdCandidate = coreStatId(championId, role, rankTier, gameVersion, region)
      const countBan = bannedChampions.has(championId) ? 1 : 0

      const coreRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO agg_champion_core_stats (
          id,
          champion_id,
          role,
          rank_tier,
          game_version,
          region,
          count_win,
          count_game,
          count_ban,
          updated_at
        )
        VALUES (
          ${statIdCandidate},
          ${championId},
          ${role},
          ${rankTier},
          ${gameVersion},
          ${region},
          ${wins},
          1,
          ${countBan},
          NOW()
        )
        ON CONFLICT (champion_id, role, rank_tier, game_version, region) DO UPDATE
        SET count_game = agg_champion_core_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_core_stats.count_win + EXCLUDED.count_win,
            count_ban = agg_champion_core_stats.count_ban + EXCLUDED.count_ban,
            updated_at = NOW()
        RETURNING id
      `
      const statId = coreRows[0]?.id
      if (statId == null) continue
      const sumGoldEarned = readParticipantMetricInt(p, 'goldEarned')
      const sumGoldSpent = readParticipantMetricInt(p, 'goldSpent')
      const sumMaxLevelLeadLaneOpponent = readParticipantMetricInt(p, 'maxLevelLeadLaneOpponent')
      const sumMaxKillDeficit = readParticipantMetricInt(p, 'maxKillDeficit')
      const sumMoreEnemyJungleThanOpponent = readParticipantMetricInt(p, 'moreEnemyJungleThanOpponent')
      const sumMaxCsAdvantageOnLaneOpponent = readParticipantMetricInt(p, 'maxCsAdvantageOnLaneOpponent')
      const sumVisionScoreAdvantageLaneOpponent = readParticipantMetricInt(p, 'visionScoreAdvantageLaneOpponent')
      const sumLaningPhaseGoldExpAdvantage = readParticipantMetricInt(
        p,
        'laningPhaseGoldExpAdvantage'
      )
      const sumEarlyLaningPhaseGoldExpAdvantage = readParticipantMetricInt(
        p,
        'earlyLaningPhaseGoldExpAdvantage'
      )
      await tx.$executeRaw`
        UPDATE agg_champion_core_stats
        SET
          sum_gold_earned = agg_champion_core_stats.sum_gold_earned + ${sumGoldEarned},
          sum_gold_spent = agg_champion_core_stats.sum_gold_spent + ${sumGoldSpent},
          sum_max_level_lead_lane_opponent = agg_champion_core_stats.sum_max_level_lead_lane_opponent + ${sumMaxLevelLeadLaneOpponent},
          sum_max_kill_deficit = agg_champion_core_stats.sum_max_kill_deficit + ${sumMaxKillDeficit},
          sum_more_enemy_jungle_than_opponent = agg_champion_core_stats.sum_more_enemy_jungle_than_opponent + ${sumMoreEnemyJungleThanOpponent},
          sum_max_cs_advantage_on_lane_opponent = agg_champion_core_stats.sum_max_cs_advantage_on_lane_opponent + ${sumMaxCsAdvantageOnLaneOpponent},
          sum_vision_score_advantage_lane_opponent = agg_champion_core_stats.sum_vision_score_advantage_lane_opponent + ${sumVisionScoreAdvantageLaneOpponent},
          sum_laning_phase_gold_exp_advantage = agg_champion_core_stats.sum_laning_phase_gold_exp_advantage + ${sumLaningPhaseGoldExpAdvantage},
          sum_early_laning_phase_gold_exp_advantage = agg_champion_core_stats.sum_early_laning_phase_gold_exp_advantage + ${sumEarlyLaningPhaseGoldExpAdvantage}
        WHERE id = ${statId}
      `
      const physToChamps = toSafeInt(p.physicalDamageDealtToChampions)
      const magicToChamps = toSafeInt(p.magicDamageDealtToChampions)
      const trueToChamps = toSafeInt(p.trueDamageDealtToChampions)
      const totalToChampsRaw = toSafeInt(p.totalDamageDealtToChampions)
      const totalToChamps =
        totalToChampsRaw > 0 ? totalToChampsRaw : physToChamps + magicToChamps + trueToChamps
      await tx.$executeRaw`
        INSERT INTO agg_champion_damage_stats (
          champion_stat_id,
          sum_physical_damage_to_champions,
          sum_magic_damage_to_champions,
          sum_true_damage_to_champions,
          sum_total_damage_to_champions,
          sum_true_damage_taken,
          sum_physical_damage_taken,
          sum_magic_damage_taken,
          sum_true_damage_done,
          sum_physical_damage_done,
          sum_magic_damage_done,
          sum_true_damage_done_to_champions,
          sum_physical_damage_done_to_champions,
          sum_magic_damage_done_to_champions,
          count_time_enemy_spent_controlled,
          sum_total_units_healed,
          sum_total_units_healed_to_champions,
          sum_heal_from_map_sources,
          sum_damage_per_minute,
          sum_effective_heal_and_shielding,
          sum_damage_dealt_to_buildings,
          sum_damage_dealt_to_epic_monsters,
          sum_damage_dealt_to_objectives,
          sum_damage_dealt_to_turrets,
          sum_damage_self_mitigated,
          sum_total_time_cc_dealt,
          sum_largest_critical_strike,
          sum_total_heal,
          sum_total_heals_on_teammates,
          count_game,
          updated_at
        )
        VALUES (
          ${statId},
          ${physToChamps},
          ${magicToChamps},
          ${trueToChamps},
          ${totalToChamps},
          ${readParticipantMetricInt(p, 'trueDamageTaken')},
          ${readParticipantMetricInt(p, 'physicalDamageTaken')},
          ${readParticipantMetricInt(p, 'magicDamageTaken')},
          ${readParticipantMetricInt(p, 'trueDamageDealt')},
          ${readParticipantMetricInt(p, 'physicalDamageDealt')},
          ${readParticipantMetricInt(p, 'magicDamageDealt')},
          ${readParticipantMetricInt(p, 'trueDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'physicalDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'magicDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'timeEnemySpentControlled') > 0 ? 1 : 0},
          ${readParticipantMetricInt(p, 'totalUnitsHealed')},
          ${readParticipantMetricInt(p, 'totalUnitsHealedToChampions')},
          ${readParticipantMetricInt(p, 'healFromMapSources')},
          ${readParticipantMetricInt(p, 'damagePerMinute')},
          ${readParticipantMetricInt(p, 'effectiveHealAndShielding')},
          ${readParticipantMetricInt(p, 'damageDealtToBuildings')},
          ${readParticipantMetricInt(p, 'damageDealtToEpicMonsters')},
          ${readParticipantMetricInt(p, 'damageDealtToObjectives')},
          ${readParticipantMetricInt(p, 'damageDealtToTurrets')},
          ${readParticipantMetricInt(p, 'damageSelfMitigated')},
          ${readParticipantMetricInt(p, 'totalTimeCCDealt')},
          ${readParticipantMetricInt(p, 'largestCriticalStrike')},
          ${readParticipantMetricInt(p, 'totalHeal')},
          ${readParticipantMetricInt(p, 'totalHealsOnTeammates')},
          1,
          NOW()
        )
        ON CONFLICT (champion_stat_id) DO UPDATE
        SET
          sum_physical_damage_to_champions =
            agg_champion_damage_stats.sum_physical_damage_to_champions
            + EXCLUDED.sum_physical_damage_to_champions,
          sum_magic_damage_to_champions =
            agg_champion_damage_stats.sum_magic_damage_to_champions
            + EXCLUDED.sum_magic_damage_to_champions,
          sum_true_damage_to_champions =
            agg_champion_damage_stats.sum_true_damage_to_champions
            + EXCLUDED.sum_true_damage_to_champions,
          sum_total_damage_to_champions =
            agg_champion_damage_stats.sum_total_damage_to_champions
            + EXCLUDED.sum_total_damage_to_champions,
          sum_true_damage_taken = agg_champion_damage_stats.sum_true_damage_taken + EXCLUDED.sum_true_damage_taken,
          sum_physical_damage_taken = agg_champion_damage_stats.sum_physical_damage_taken + EXCLUDED.sum_physical_damage_taken,
          sum_magic_damage_taken = agg_champion_damage_stats.sum_magic_damage_taken + EXCLUDED.sum_magic_damage_taken,
          sum_true_damage_done = agg_champion_damage_stats.sum_true_damage_done + EXCLUDED.sum_true_damage_done,
          sum_physical_damage_done = agg_champion_damage_stats.sum_physical_damage_done + EXCLUDED.sum_physical_damage_done,
          sum_magic_damage_done = agg_champion_damage_stats.sum_magic_damage_done + EXCLUDED.sum_magic_damage_done,
          sum_true_damage_done_to_champions =
            agg_champion_damage_stats.sum_true_damage_done_to_champions + EXCLUDED.sum_true_damage_done_to_champions,
          sum_physical_damage_done_to_champions =
            agg_champion_damage_stats.sum_physical_damage_done_to_champions + EXCLUDED.sum_physical_damage_done_to_champions,
          sum_magic_damage_done_to_champions =
            agg_champion_damage_stats.sum_magic_damage_done_to_champions + EXCLUDED.sum_magic_damage_done_to_champions,
          count_time_enemy_spent_controlled =
            agg_champion_damage_stats.count_time_enemy_spent_controlled + EXCLUDED.count_time_enemy_spent_controlled,
          sum_total_units_healed = agg_champion_damage_stats.sum_total_units_healed + EXCLUDED.sum_total_units_healed,
          sum_total_units_healed_to_champions =
            agg_champion_damage_stats.sum_total_units_healed_to_champions + EXCLUDED.sum_total_units_healed_to_champions,
          sum_heal_from_map_sources = agg_champion_damage_stats.sum_heal_from_map_sources + EXCLUDED.sum_heal_from_map_sources,
          sum_damage_per_minute = agg_champion_damage_stats.sum_damage_per_minute + EXCLUDED.sum_damage_per_minute,
          sum_effective_heal_and_shielding =
            agg_champion_damage_stats.sum_effective_heal_and_shielding + EXCLUDED.sum_effective_heal_and_shielding,
          sum_damage_dealt_to_buildings =
            agg_champion_damage_stats.sum_damage_dealt_to_buildings + EXCLUDED.sum_damage_dealt_to_buildings,
          sum_damage_dealt_to_epic_monsters =
            agg_champion_damage_stats.sum_damage_dealt_to_epic_monsters + EXCLUDED.sum_damage_dealt_to_epic_monsters,
          sum_damage_dealt_to_objectives =
            agg_champion_damage_stats.sum_damage_dealt_to_objectives + EXCLUDED.sum_damage_dealt_to_objectives,
          sum_damage_dealt_to_turrets =
            agg_champion_damage_stats.sum_damage_dealt_to_turrets + EXCLUDED.sum_damage_dealt_to_turrets,
          sum_damage_self_mitigated =
            agg_champion_damage_stats.sum_damage_self_mitigated + EXCLUDED.sum_damage_self_mitigated,
          sum_total_time_cc_dealt = agg_champion_damage_stats.sum_total_time_cc_dealt + EXCLUDED.sum_total_time_cc_dealt,
          sum_largest_critical_strike =
            agg_champion_damage_stats.sum_largest_critical_strike + EXCLUDED.sum_largest_critical_strike,
          sum_total_heal = agg_champion_damage_stats.sum_total_heal + EXCLUDED.sum_total_heal,
          sum_total_heals_on_teammates =
            agg_champion_damage_stats.sum_total_heals_on_teammates + EXCLUDED.sum_total_heals_on_teammates,
          count_game = agg_champion_damage_stats.count_game + EXCLUDED.count_game,
          updated_at = NOW()
      `
      const participantAggColumns = await getParticipantAggColumns()
      const participantAggValues = participantAggColumns.map((c) =>
        Math.trunc(participantValueForAggColumn(p, c))
      )
      const participantColumnsSql = participantAggColumns.join(', ')
      const participantValuesSql = participantAggValues.join(', ')
      const participantSetSql = participantAggColumns
        .map((c) => `${c} = agg_champion_participant_stats.${c} + EXCLUDED.${c}`)
        .join(', ')
      await tx.$executeRawUnsafe(`
        INSERT INTO agg_champion_participant_stats (
          champion_stat_id,
          ${participantColumnsSql},
          updated_at
        )
        VALUES (
          ${statId.toString()},
          ${participantValuesSql},
          NOW()
        )
        ON CONFLICT (champion_stat_id) DO UPDATE
        SET
          ${participantSetSql},
          updated_at = NOW()
      `)

      const teamId = toSafeInt(p.teamId)
      const opponentTeamId = teamId === 100 ? 200 : 100
      const opponents = participantByTeamRole.get(`${opponentTeamId}|${role}`) ?? []
      const opponentChampionId = toSafeInt(opponents[0]?.championId)
      if (opponentChampionId > 0) {
        await tx.$executeRaw`
          INSERT INTO agg_champion_vs_stats (
            champion_stat_id,
            opponent_champion_id,
            role,
            rank_tier,
            game_version,
            region,
            count_win,
            count_game,
            sum_gold_earned,
            sum_gold_spent,
            sum_max_level_lead_lane_opponent,
            sum_max_kill_deficit,
            sum_more_enemy_jungle_than_opponent,
            sum_max_cs_advantage_on_lane_opponent,
            sum_vision_score_advantage_lane_opponent,
            sum_laning_phase_gold_exp_advantage,
            sum_early_laning_phase_gold_exp_advantage,
            updated_at
          )
          VALUES (
            ${statId},
            ${opponentChampionId},
            ${role},
            ${rankTier},
            ${gameVersion},
            ${region},
            ${wins},
            1,
            ${sumGoldEarned},
            ${sumGoldSpent},
            ${sumMaxLevelLeadLaneOpponent},
            ${sumMaxKillDeficit},
            ${sumMoreEnemyJungleThanOpponent},
            ${sumMaxCsAdvantageOnLaneOpponent},
            ${sumVisionScoreAdvantageLaneOpponent},
            ${sumLaningPhaseGoldExpAdvantage},
            ${sumEarlyLaningPhaseGoldExpAdvantage},
            NOW()
          )
          ON CONFLICT (champion_stat_id, opponent_champion_id) DO UPDATE
          SET count_game = agg_champion_vs_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_vs_stats.count_win + EXCLUDED.count_win,
              sum_gold_earned = agg_champion_vs_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
              sum_gold_spent = agg_champion_vs_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
              sum_max_level_lead_lane_opponent = agg_champion_vs_stats.sum_max_level_lead_lane_opponent + EXCLUDED.sum_max_level_lead_lane_opponent,
              sum_max_kill_deficit = agg_champion_vs_stats.sum_max_kill_deficit + EXCLUDED.sum_max_kill_deficit,
              sum_more_enemy_jungle_than_opponent = agg_champion_vs_stats.sum_more_enemy_jungle_than_opponent + EXCLUDED.sum_more_enemy_jungle_than_opponent,
              sum_max_cs_advantage_on_lane_opponent = agg_champion_vs_stats.sum_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
              sum_vision_score_advantage_lane_opponent = agg_champion_vs_stats.sum_vision_score_advantage_lane_opponent + EXCLUDED.sum_vision_score_advantage_lane_opponent,
              sum_laning_phase_gold_exp_advantage = agg_champion_vs_stats.sum_laning_phase_gold_exp_advantage + EXCLUDED.sum_laning_phase_gold_exp_advantage,
              sum_early_laning_phase_gold_exp_advantage = agg_champion_vs_stats.sum_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_early_laning_phase_gold_exp_advantage,
              updated_at = NOW()
        `
      }

      for (let allyIdx = 0; allyIdx < participantsForAgg.length; allyIdx++) {
        if (allyIdx === idx) continue
        const ally = participantsForAgg[allyIdx]
        if (toSafeInt(ally.teamId) !== teamId) continue
        const allyChampionId = toSafeInt(ally.championId)
        if (allyChampionId <= 0) continue
        const allyRole = resolvedRoles[allyIdx] ?? roleFromPosition(ally)
        if (!isAllowedRole(allyRole)) continue
        await tx.$executeRaw`
          INSERT INTO agg_champion_duo_role_stats (
            champion_stat_id,
            ally_champion_id,
            ally_role,
            count_win,
            count_game,
            sum_gold_earned,
            sum_gold_spent,
            sum_max_level_lead_lane_opponent,
            sum_max_kill_deficit,
            sum_more_enemy_jungle_than_opponent,
            sum_max_cs_advantage_on_lane_opponent,
            sum_vision_score_advantage_lane_opponent,
            sum_laning_phase_gold_exp_advantage,
            sum_early_laning_phase_gold_exp_advantage,
            updated_at
          )
          VALUES (
            ${statId},
            ${allyChampionId},
            ${allyRole},
            ${wins},
            1,
            ${sumGoldEarned},
            ${sumGoldSpent},
            ${sumMaxLevelLeadLaneOpponent},
            ${sumMaxKillDeficit},
            ${sumMoreEnemyJungleThanOpponent},
            ${sumMaxCsAdvantageOnLaneOpponent},
            ${sumVisionScoreAdvantageLaneOpponent},
            ${sumLaningPhaseGoldExpAdvantage},
            ${sumEarlyLaningPhaseGoldExpAdvantage},
            NOW()
          )
          ON CONFLICT (champion_stat_id, ally_champion_id, ally_role) DO UPDATE
          SET count_game = agg_champion_duo_role_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_duo_role_stats.count_win + EXCLUDED.count_win,
              sum_gold_earned = agg_champion_duo_role_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
              sum_gold_spent = agg_champion_duo_role_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
              sum_max_level_lead_lane_opponent = agg_champion_duo_role_stats.sum_max_level_lead_lane_opponent + EXCLUDED.sum_max_level_lead_lane_opponent,
              sum_max_kill_deficit = agg_champion_duo_role_stats.sum_max_kill_deficit + EXCLUDED.sum_max_kill_deficit,
              sum_more_enemy_jungle_than_opponent = agg_champion_duo_role_stats.sum_more_enemy_jungle_than_opponent + EXCLUDED.sum_more_enemy_jungle_than_opponent,
              sum_max_cs_advantage_on_lane_opponent = agg_champion_duo_role_stats.sum_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
              sum_vision_score_advantage_lane_opponent = agg_champion_duo_role_stats.sum_vision_score_advantage_lane_opponent + EXCLUDED.sum_vision_score_advantage_lane_opponent,
              sum_laning_phase_gold_exp_advantage = agg_champion_duo_role_stats.sum_laning_phase_gold_exp_advantage + EXCLUDED.sum_laning_phase_gold_exp_advantage,
              sum_early_laning_phase_gold_exp_advantage = agg_champion_duo_role_stats.sum_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_early_laning_phase_gold_exp_advantage,
              updated_at = NOW()
        `
      }

      await tx.$executeRaw`
        INSERT INTO agg_champion_bucket (
          champion_stat_id,
          duration_bucket,
          count_win,
          count_game,
          sum_current_gold,
          sum_magic_damage_done,
          sum_magic_damage_done_to_champion,
          sum_magic_damage_taken,
          sum_physical_damage_done,
          sum_physical_damage_done_to_champion,
          sum_physical_damage_taken,
          sum_total_damage_done,
          sum_total_damage_done_to_champion,
          sum_total_damage_taken,
          sum_true_damage_done,
          sum_true_damage_done_to_champion,
          sum_true_damage_taken,
          sum_jungle_minions_killed,
          sum_level,
          sum_minions_killed,
          sum_time_enemy_spent_controlled,
          sum_total_gold,
          count_game_end,
          count_time_enemy_spent_controlled,
          updated_at
        )
        VALUES (
          ${statId},
          ${durationBucket},
          ${wins},
          1,
          ${readParticipantMetricInt(p, 'currentGold')},
          ${readParticipantMetricInt(p, 'magicDamageDealt')},
          ${readParticipantMetricInt(p, 'magicDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'magicDamageTaken')},
          ${readParticipantMetricInt(p, 'physicalDamageDealt')},
          ${readParticipantMetricInt(p, 'physicalDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'physicalDamageTaken')},
          ${readParticipantMetricInt(p, 'totalDamageDealt')},
          ${readParticipantMetricInt(p, 'totalDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'totalDamageTaken')},
          ${readParticipantMetricInt(p, 'trueDamageDealt')},
          ${readParticipantMetricInt(p, 'trueDamageDealtToChampions')},
          ${readParticipantMetricInt(p, 'trueDamageTaken')},
          ${readParticipantMetricInt(p, 'jungleMinionsKilled')},
          ${readParticipantMetricInt(p, 'champLevel')},
          ${readParticipantMetricInt(p, 'totalMinionsKilled')},
          ${readParticipantMetricInt(p, 'timeEnemySpentControlled')},
          ${readParticipantMetricInt(p, 'goldEarned')},
          1,
          ${readParticipantMetricInt(p, 'timeEnemySpentControlled') > 0 ? 1 : 0},
          NOW()
        )
        ON CONFLICT (champion_stat_id, duration_bucket) DO UPDATE
        SET count_game = agg_champion_bucket.count_game + EXCLUDED.count_game,
            count_win = agg_champion_bucket.count_win + EXCLUDED.count_win,
            sum_current_gold = agg_champion_bucket.sum_current_gold + EXCLUDED.sum_current_gold,
            sum_magic_damage_done = agg_champion_bucket.sum_magic_damage_done + EXCLUDED.sum_magic_damage_done,
            sum_magic_damage_done_to_champion =
              agg_champion_bucket.sum_magic_damage_done_to_champion + EXCLUDED.sum_magic_damage_done_to_champion,
            sum_magic_damage_taken = agg_champion_bucket.sum_magic_damage_taken + EXCLUDED.sum_magic_damage_taken,
            sum_physical_damage_done = agg_champion_bucket.sum_physical_damage_done + EXCLUDED.sum_physical_damage_done,
            sum_physical_damage_done_to_champion =
              agg_champion_bucket.sum_physical_damage_done_to_champion + EXCLUDED.sum_physical_damage_done_to_champion,
            sum_physical_damage_taken = agg_champion_bucket.sum_physical_damage_taken + EXCLUDED.sum_physical_damage_taken,
            sum_total_damage_done = agg_champion_bucket.sum_total_damage_done + EXCLUDED.sum_total_damage_done,
            sum_total_damage_done_to_champion =
              agg_champion_bucket.sum_total_damage_done_to_champion + EXCLUDED.sum_total_damage_done_to_champion,
            sum_total_damage_taken = agg_champion_bucket.sum_total_damage_taken + EXCLUDED.sum_total_damage_taken,
            sum_true_damage_done = agg_champion_bucket.sum_true_damage_done + EXCLUDED.sum_true_damage_done,
            sum_true_damage_done_to_champion =
              agg_champion_bucket.sum_true_damage_done_to_champion + EXCLUDED.sum_true_damage_done_to_champion,
            sum_true_damage_taken = agg_champion_bucket.sum_true_damage_taken + EXCLUDED.sum_true_damage_taken,
            sum_jungle_minions_killed =
              agg_champion_bucket.sum_jungle_minions_killed + EXCLUDED.sum_jungle_minions_killed,
            sum_level = agg_champion_bucket.sum_level + EXCLUDED.sum_level,
            sum_minions_killed = agg_champion_bucket.sum_minions_killed + EXCLUDED.sum_minions_killed,
            sum_time_enemy_spent_controlled =
              agg_champion_bucket.sum_time_enemy_spent_controlled + EXCLUDED.sum_time_enemy_spent_controlled,
            sum_total_gold = agg_champion_bucket.sum_total_gold + EXCLUDED.sum_total_gold,
            count_game_end = agg_champion_bucket.count_game_end + EXCLUDED.count_game_end,
            count_time_enemy_spent_controlled =
              agg_champion_bucket.count_time_enemy_spent_controlled + EXCLUDED.count_time_enemy_spent_controlled,
            updated_at = NOW()
      `

      const spellD = toSafeInt((p as RawParticipant).summoner1Id)
      const spellF = toSafeInt((p as RawParticipant).summoner2Id)
      const participantId = toSafeInt(p.participantId)
      const timelineSpellOrder =
        participantId > 0 ? timelineSpellOrdersByParticipant.get(participantId) ?? [] : []
      const spellOrder =
        timelineSpellOrder.length > 0 ? timelineSpellOrder : extractSpellOrder(p)
      const spellOrderKey = spellOrder.length > 0 ? spellOrder.join('-') : ''
      const existingSpellRows = await tx.$queryRaw<Array<{ spell_order: unknown }>>`
        SELECT spell_order
        FROM agg_champion_spells_stats
        WHERE champion_stat_id = ${statId}
        FOR UPDATE
      `
      const existingSpellOrderMap = parseSpellOrderMap(existingSpellRows[0]?.spell_order)
      if (spellOrderKey) {
        const prev = existingSpellOrderMap[spellOrderKey] ?? {
          order: spellOrder,
          number_of_games: 0,
          number_of_wins: 0,
        }
        existingSpellOrderMap[spellOrderKey] = {
          order: spellOrder,
          number_of_games: prev.number_of_games + 1,
          number_of_wins: prev.number_of_wins + wins,
        }
      }
      await tx.$executeRaw`
        INSERT INTO agg_champion_spells_stats (
          champion_stat_id,
          spell1_casts,
          spell2_casts,
          spell3_casts,
          spell4_casts,
          spell_order,
          count_game,
          count_win,
          updated_at
        )
        VALUES (
          ${statId},
          ${toSafeInt((p as RawParticipant).spell1Casts)},
          ${toSafeInt((p as RawParticipant).spell2Casts)},
          ${toSafeInt((p as RawParticipant).spell3Casts)},
          ${toSafeInt((p as RawParticipant).spell4Casts)},
          ${JSON.stringify(existingSpellOrderMap)}::jsonb,
          1,
          ${wins},
          NOW()
        )
        ON CONFLICT (champion_stat_id) DO UPDATE
        SET
          spell1_casts = agg_champion_spells_stats.spell1_casts + EXCLUDED.spell1_casts,
          spell2_casts = agg_champion_spells_stats.spell2_casts + EXCLUDED.spell2_casts,
          spell3_casts = agg_champion_spells_stats.spell3_casts + EXCLUDED.spell3_casts,
          spell4_casts = agg_champion_spells_stats.spell4_casts + EXCLUDED.spell4_casts,
          spell_order = EXCLUDED.spell_order,
          count_game = agg_champion_spells_stats.count_game + EXCLUDED.count_game,
          count_win = agg_champion_spells_stats.count_win + EXCLUDED.count_win,
          updated_at = NOW()
      `
      if (spellD > 0) {
        await tx.$executeRaw`
          INSERT INTO agg_champion_summoner_spells (
            champion_stat_id,
            spell_id,
            count_win,
            count_game,
            count_slot0,
            count_slot1,
            updated_at
          )
          VALUES (
            ${statId},
            ${spellD},
            ${wins},
            1,
            1,
            0,
            NOW()
          )
          ON CONFLICT (champion_stat_id, spell_id) DO UPDATE
          SET count_game = agg_champion_summoner_spells.count_game + EXCLUDED.count_game,
              count_win = agg_champion_summoner_spells.count_win + EXCLUDED.count_win,
              count_slot0 = agg_champion_summoner_spells.count_slot0 + EXCLUDED.count_slot0,
              count_slot1 = agg_champion_summoner_spells.count_slot1 + EXCLUDED.count_slot1,
              updated_at = NOW()
        `
      }
      if (spellF > 0) {
        await tx.$executeRaw`
          INSERT INTO agg_champion_summoner_spells (
            champion_stat_id,
            spell_id,
            count_win,
            count_game,
            count_slot0,
            count_slot1,
            updated_at
          )
          VALUES (
            ${statId},
            ${spellF},
            ${wins},
            1,
            0,
            1,
            NOW()
          )
          ON CONFLICT (champion_stat_id, spell_id) DO UPDATE
          SET count_game = agg_champion_summoner_spells.count_game + EXCLUDED.count_game,
              count_win = agg_champion_summoner_spells.count_win + EXCLUDED.count_win,
              count_slot0 = agg_champion_summoner_spells.count_slot0 + EXCLUDED.count_slot0,
              count_slot1 = agg_champion_summoner_spells.count_slot1 + EXCLUDED.count_slot1,
              updated_at = NOW()
        `
      }

      const { runes, shards } = extractRunesAndShards(p)
      if (runes.length > 0 || shards.length > 0) {
        const runeList = JSON.stringify(runes)
        const shardList = shards.join(',')
        await tx.$executeRaw`
          INSERT INTO agg_champion_runes_stats (
            champion_stat_id,
            rune_list,
            shard_list,
            count_win,
            count_game,
            updated_at
          )
          VALUES (${statId}, ${runeList}, ${shardList}, ${wins}, 1, NOW())
          ON CONFLICT (champion_stat_id, rune_list, shard_list) DO UPDATE
          SET count_game = agg_champion_runes_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_runes_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }

      for (const runeId of runes) {
        await tx.$executeRaw`
          INSERT INTO agg_champion_runes_solo_stats (
            champion_stat_id,
            perk_id,
            count_win,
            count_game,
            updated_at
          )
          VALUES (${statId}, ${runeId}, ${wins}, 1, NOW())
          ON CONFLICT (champion_stat_id, perk_id) DO UPDATE
          SET count_game = agg_champion_runes_solo_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_runes_solo_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }

      for (let slot = 0; slot < shards.length; slot++) {
        const shardId = shards[slot]!
        await tx.$executeRaw`
          INSERT INTO agg_champion_shard_solo_stats (
            champion_stat_id,
            shard_id,
            slot,
            count_win,
            count_game,
            updated_at
          )
          VALUES (${statId}, ${shardId}, ${slot}, ${wins}, 1, NOW())
          ON CONFLICT (champion_stat_id, shard_id, slot) DO UPDATE
          SET count_game = agg_champion_shard_solo_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_shard_solo_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }

      const finalItems = extractFinalItems(p)
      const itemList = JSON.stringify(finalItems)
      await tx.$executeRaw`
        INSERT INTO agg_champion_item_stats (
          champion_stat_id,
          item_list,
          count_win,
          count_game,
          sum_timestamp_ms,
          updated_at
        )
        VALUES (${statId}, ${itemList}, ${wins}, 1, 0, NOW())
        ON CONFLICT (champion_stat_id, item_list) DO UPDATE
        SET count_game = agg_champion_item_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_item_stats.count_win + EXCLUDED.count_win,
            sum_timestamp_ms = agg_champion_item_stats.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms,
            updated_at = NOW()
      `

      const participantIdForItems = toSafeInt(p.participantId)
      const selectedItems =
        participantIdForItems > 0
          ? await selectMatchPlayerItems({
              participant: p as unknown as Record<string, unknown>,
              participantId: participantIdForItems,
              events: timelineItemEvents,
            })
          : []
      for (const item of selectedItems) {
        const itemId = toSafeInt(item.itemId)
        if (itemId <= 0) continue
        const isStarter = item.starter === true ? 1 : 0
        const isCore = item.core === true ? 1 : 0
        const isFinal = isStarter === 0 && isCore === 0 ? 1 : 0
        await tx.$executeRaw`
          INSERT INTO agg_champion_item_solo_stats (
            champion_stat_id,
            item_id,
            count_starter,
            count_core,
            count_final,
            count_win,
            count_game,
            sum_timestamp_ms,
            updated_at
          )
          VALUES (${statId}, ${itemId}, ${isStarter}, ${isCore}, ${isFinal}, ${wins}, 1, ${toSafeInt(item.timestampMs)}, NOW())
          ON CONFLICT (champion_stat_id, item_id) DO UPDATE
          SET count_starter = agg_champion_item_solo_stats.count_starter + EXCLUDED.count_starter,
              count_core = agg_champion_item_solo_stats.count_core + EXCLUDED.count_core,
              count_final = agg_champion_item_solo_stats.count_final + EXCLUDED.count_final,
              count_game = agg_champion_item_solo_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_item_solo_stats.count_win + EXCLUDED.count_win,
              sum_timestamp_ms = agg_champion_item_solo_stats.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms,
              updated_at = NOW()
        `
      }

      const starterItems = selectedItems
        .filter((item) => item.starter === true)
        .map((item) => toSafeInt(item.itemId))
        .filter((itemId) => itemId > 0 && !STARTER_SET_EXCLUDED_ITEM_IDS.has(itemId))
      if (starterItems.length > 0) {
        const starterKey = `[${starterItems.join(',')}]`
        await tx.$executeRaw`
          INSERT INTO agg_champion_item_starter_set_stats (
            game_version,
            rank_tier,
            role_norm,
            champion_id,
            starter_key,
            count_game,
            count_win,
            updated_at
          )
          VALUES (
            ${gameVersion},
            ${rankTier},
            ${role},
            ${championId},
            ${starterKey},
            1,
            ${wins},
            NOW()
          )
          ON CONFLICT (game_version, rank_tier, role_norm, champion_id, starter_key) DO UPDATE
          SET count_game = agg_champion_item_starter_set_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_item_starter_set_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }

    }

    const botTeam100 = (participantByTeamRole.get('100|BOTTOM') ?? [])[0]
    const supTeam100 = (participantByTeamRole.get('100|SUPPORT') ?? [])[0]
    const botTeam200 = (participantByTeamRole.get('200|BOTTOM') ?? [])[0]
    const supTeam200 = (participantByTeamRole.get('200|SUPPORT') ?? [])[0]
    if (botTeam100 && supTeam100 && botTeam200 && supTeam200) {
      const adc100 = toSafeInt(botTeam100.championId)
      const support100 = toSafeInt(supTeam100.championId)
      const adc200 = toSafeInt(botTeam200.championId)
      const support200 = toSafeInt(supTeam200.championId)
      const rankTier100 = normalizeRankTier(botTeam100)
      const rankTier200 = normalizeRankTier(botTeam200)
      if (
        adc100 > 0 &&
        support100 > 0 &&
        adc200 > 0 &&
        support200 > 0 &&
        rankTier100 !== 'UNRANKED' &&
        rankTier200 !== 'UNRANKED'
      ) {
        const win100 = botTeam100.win === true ? 1 : 0
        const win200 = botTeam200.win === true ? 1 : 0
        await tx.$executeRaw`
          INSERT INTO agg_botlane_duo_vs_duo_stats (
            adc_id,
            support_id,
            opp_adc_id,
            opp_support_id,
            rank_tier,
            game_version,
            region,
            count_win,
            count_game,
            updated_at
          )
          VALUES (
            ${adc100},
            ${support100},
            ${adc200},
            ${support200},
            ${rankTier100},
            ${gameVersion},
            ${region},
            ${win100},
            1,
            NOW()
          )
          ON CONFLICT (adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region) DO UPDATE
          SET count_game = agg_botlane_duo_vs_duo_stats.count_game + EXCLUDED.count_game,
              count_win = agg_botlane_duo_vs_duo_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
        await tx.$executeRaw`
          INSERT INTO agg_botlane_duo_vs_duo_stats (
            adc_id,
            support_id,
            opp_adc_id,
            opp_support_id,
            rank_tier,
            game_version,
            region,
            count_win,
            count_game,
            updated_at
          )
          VALUES (
            ${adc200},
            ${support200},
            ${adc100},
            ${support100},
            ${rankTier200},
            ${gameVersion},
            ${region},
            ${win200},
            1,
            NOW()
          )
          ON CONFLICT (adc_id, support_id, opp_adc_id, opp_support_id, rank_tier, game_version, region) DO UPDATE
          SET count_game = agg_botlane_duo_vs_duo_stats.count_game + EXCLUDED.count_game,
              count_win = agg_botlane_duo_vs_duo_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }
    }

    for (let idx = 0; idx < participantsForAgg.length; idx++) {
      const participant = participantsForAgg[idx]
      const rankTier = normalizeRankTier(participant)
      if (rankTier === 'UNRANKED') continue
      const role = resolvedRoles[idx] ?? roleFromPosition(participant)
      if (!isAllowedRole(role)) continue
      const championId = toSafeInt(participant.championId)
      if (championId <= 0) continue
      const spellD = toSafeInt(participant.summoner1Id)
      const spellF = toSafeInt(participant.summoner2Id)
      if (spellD <= 0 || spellF <= 0) continue
      const spell1Casts = readParticipantMetricInt(participant, 'spell1Casts')
      const spell2Casts = readParticipantMetricInt(participant, 'spell2Casts')
      const countWin = participant.win === true ? 1 : 0
      await tx.$executeRaw`
        INSERT INTO agg_champion_summoner_spell_pair_stats (
          game_version, rank_tier, role, champion_id, spell_d, spell_f, spell1_casts, spell2_casts, count_game, count_win, updated_at
        )
        VALUES (
          ${gameVersion}, ${rankTier}, ${role}, ${championId}, ${spellD}, ${spellF},
          ${spell1Casts}, ${spell2Casts},
          1, ${countWin}, NOW()
        )
        ON CONFLICT (game_version, rank_tier, role, champion_id, spell_d, spell_f) DO UPDATE
        SET count_game = agg_champion_summoner_spell_pair_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_summoner_spell_pair_stats.count_win + EXCLUDED.count_win,
            spell1_casts = agg_champion_summoner_spell_pair_stats.spell1_casts + EXCLUDED.spell1_casts,
            spell2_casts = agg_champion_summoner_spell_pair_stats.spell2_casts + EXCLUDED.spell2_casts,
            updated_at = NOW()
      `
    }

    const matchRankTier =
      participantsForAgg.map((p) => normalizeRankTier(p)).find((t) => t !== 'UNRANKED') ?? 'UNRANKED'

    if (matchRankTier !== 'UNRANKED') {
      await tx.$executeRaw`
        INSERT INTO agg_match_outcome_stats (game_version, rank_tier, count_match, updated_at)
        VALUES (${gameVersion}, ${matchRankTier}, 1, NOW())
        ON CONFLICT (game_version, rank_tier) DO UPDATE
        SET count_match = agg_match_outcome_stats.count_match + EXCLUDED.count_match,
            updated_at = NOW()
      `
    }

    for (let idx = 0; idx < participantsForAgg.length; idx++) {
      const p = participantsForAgg[idx]
      const championId = toSafeInt(p.championId)
      const teamNum = toSafeInt(p.teamId)
      if (championId <= 0 || (teamNum !== 100 && teamNum !== 200)) continue
      const role = resolvedRoles[idx] ?? roleFromPosition(p)
      if (!isAllowedRole(role)) continue
      const rankTier = normalizeRankTier(p)
      if (rankTier === 'UNRANKED') continue
      const wins = p.win === true ? 1 : 0
      const sumGoldEarned = readParticipantMetricInt(p, 'goldEarned')
      const sumGoldSpent = readParticipantMetricInt(p, 'goldSpent')
      const sumMaxLevelLeadLaneOpponent = readParticipantMetricInt(p, 'maxLevelLeadLaneOpponent')
      const sumMaxKillDeficit = readParticipantMetricInt(p, 'maxKillDeficit')
      const sumMoreEnemyJungleThanOpponent = readParticipantMetricInt(p, 'moreEnemyJungleThanOpponent')
      const sumMaxCsAdvantageOnLaneOpponent = readParticipantMetricInt(
        p,
        'maxCsAdvantageOnLaneOpponent'
      )
      const sumVisionScoreAdvantageLaneOpponent = readParticipantMetricInt(
        p,
        'visionScoreAdvantageLaneOpponent'
      )
      const sumLaningPhaseGoldExpAdvantage = readParticipantMetricInt(
        p,
        'laningPhaseGoldExpAdvantage'
      )
      const sumEarlyLaningPhaseGoldExpAdvantage = readParticipantMetricInt(
        p,
        'earlyLaningPhaseGoldExpAdvantage'
      )
      const physToChamps = toSafeInt(p.physicalDamageDealtToChampions)
      const magicToChamps = toSafeInt(p.magicDamageDealtToChampions)
      const trueToChamps = toSafeInt(p.trueDamageDealtToChampions)
      await tx.$executeRaw`
        INSERT INTO agg_champion_side_stats (
          team_num,
          champion_id,
          role_norm,
          game_version,
          rank_tier,
          count_win,
          count_game,
          sum_gold_earned,
          sum_gold_spent,
          sum_max_level_lead_lane_opponent,
          sum_max_kill_deficit,
          sum_more_enemy_jungle_than_opponent,
          sum_max_cs_advantage_on_lane_opponent,
          sum_vision_score_advantage_lane_opponent,
          sum_laning_phase_gold_exp_advantage,
          sum_early_laning_phase_gold_exp_advantage,
          sum_physical_damage_to_champions,
          sum_magic_damage_to_champions,
          sum_true_damage_to_champions,
          sum_total_units_healed,
          sum_total_units_healed_to_champions,
          sum_heal_from_map_sources,
          sum_damage_per_minute,
          sum_effective_heal_and_shielding,
          sum_damage_dealt_to_buildings,
          sum_damage_dealt_to_epic_monsters,
          sum_damage_dealt_to_objectives,
          sum_damage_dealt_to_turrets,
          sum_damage_self_mitigated,
          updated_at
        )
        VALUES (
          ${teamNum}, ${championId}, ${role}, ${gameVersion}, ${rankTier}, ${wins}, 1,
          ${sumGoldEarned}, ${sumGoldSpent}, ${sumMaxLevelLeadLaneOpponent}, ${sumMaxKillDeficit},
          ${sumMoreEnemyJungleThanOpponent}, ${sumMaxCsAdvantageOnLaneOpponent}, ${sumVisionScoreAdvantageLaneOpponent},
          ${sumLaningPhaseGoldExpAdvantage}, ${sumEarlyLaningPhaseGoldExpAdvantage},
          ${physToChamps}, ${magicToChamps}, ${trueToChamps},
          ${readParticipantMetricInt(p, 'totalUnitsHealed')},
          ${readParticipantMetricInt(p, 'totalUnitsHealedToChampions')},
          ${readParticipantMetricInt(p, 'healFromMapSources')},
          ${readParticipantMetricInt(p, 'damagePerMinute')},
          ${readParticipantMetricInt(p, 'effectiveHealAndShielding')},
          ${readParticipantMetricInt(p, 'damageDealtToBuildings')},
          ${readParticipantMetricInt(p, 'damageDealtToEpicMonsters')},
          ${readParticipantMetricInt(p, 'damageDealtToObjectives')},
          ${readParticipantMetricInt(p, 'damageDealtToTurrets')},
          ${readParticipantMetricInt(p, 'damageSelfMitigated')},
          NOW()
        )
        ON CONFLICT (team_num, champion_id, role_norm, game_version, rank_tier) DO UPDATE
        SET count_game = agg_champion_side_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_side_stats.count_win + EXCLUDED.count_win,
            sum_gold_earned = agg_champion_side_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
            sum_gold_spent = agg_champion_side_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
            sum_max_level_lead_lane_opponent = agg_champion_side_stats.sum_max_level_lead_lane_opponent + EXCLUDED.sum_max_level_lead_lane_opponent,
            sum_max_kill_deficit = agg_champion_side_stats.sum_max_kill_deficit + EXCLUDED.sum_max_kill_deficit,
            sum_more_enemy_jungle_than_opponent = agg_champion_side_stats.sum_more_enemy_jungle_than_opponent + EXCLUDED.sum_more_enemy_jungle_than_opponent,
            sum_max_cs_advantage_on_lane_opponent = agg_champion_side_stats.sum_max_cs_advantage_on_lane_opponent + EXCLUDED.sum_max_cs_advantage_on_lane_opponent,
            sum_vision_score_advantage_lane_opponent =
              agg_champion_side_stats.sum_vision_score_advantage_lane_opponent + EXCLUDED.sum_vision_score_advantage_lane_opponent,
            sum_laning_phase_gold_exp_advantage =
              agg_champion_side_stats.sum_laning_phase_gold_exp_advantage + EXCLUDED.sum_laning_phase_gold_exp_advantage,
            sum_early_laning_phase_gold_exp_advantage =
              agg_champion_side_stats.sum_early_laning_phase_gold_exp_advantage + EXCLUDED.sum_early_laning_phase_gold_exp_advantage,
            sum_physical_damage_to_champions =
              agg_champion_side_stats.sum_physical_damage_to_champions + EXCLUDED.sum_physical_damage_to_champions,
            sum_magic_damage_to_champions =
              agg_champion_side_stats.sum_magic_damage_to_champions + EXCLUDED.sum_magic_damage_to_champions,
            sum_true_damage_to_champions =
              agg_champion_side_stats.sum_true_damage_to_champions + EXCLUDED.sum_true_damage_to_champions,
            sum_total_units_healed =
              agg_champion_side_stats.sum_total_units_healed + EXCLUDED.sum_total_units_healed,
            sum_total_units_healed_to_champions =
              agg_champion_side_stats.sum_total_units_healed_to_champions + EXCLUDED.sum_total_units_healed_to_champions,
            sum_heal_from_map_sources =
              agg_champion_side_stats.sum_heal_from_map_sources + EXCLUDED.sum_heal_from_map_sources,
            sum_damage_per_minute = agg_champion_side_stats.sum_damage_per_minute + EXCLUDED.sum_damage_per_minute,
            sum_effective_heal_and_shielding =
              agg_champion_side_stats.sum_effective_heal_and_shielding + EXCLUDED.sum_effective_heal_and_shielding,
            sum_damage_dealt_to_buildings =
              agg_champion_side_stats.sum_damage_dealt_to_buildings + EXCLUDED.sum_damage_dealt_to_buildings,
            sum_damage_dealt_to_epic_monsters =
              agg_champion_side_stats.sum_damage_dealt_to_epic_monsters + EXCLUDED.sum_damage_dealt_to_epic_monsters,
            sum_damage_dealt_to_objectives =
              agg_champion_side_stats.sum_damage_dealt_to_objectives + EXCLUDED.sum_damage_dealt_to_objectives,
            sum_damage_dealt_to_turrets =
              agg_champion_side_stats.sum_damage_dealt_to_turrets + EXCLUDED.sum_damage_dealt_to_turrets,
            sum_damage_self_mitigated =
              agg_champion_side_stats.sum_damage_self_mitigated + EXCLUDED.sum_damage_self_mitigated,
            updated_at = NOW()
      `
    }

    for (const team of infoAny.info?.teams ?? []) {
      const teamNum = toSafeInt(team.teamId)
      if (teamNum !== 100 && teamNum !== 200) continue
      if (matchRankTier === 'UNRANKED') continue
      const idCandidate = teamCoreId(teamNum, matchRankTier, gameVersion)
      const objectives = team.objectives ?? {}
      const readKills = (k: string) => toSafeInt(objectives[k]?.kills)
      const readFirst = (k: string) => (objectives[k]?.first === true ? 1 : 0)
      const inhibitorFirstResolved =
        readFirst('inhibitor') > 0 || firstInhibitorTeamId === teamNum ? 1 : 0
      const win = team.win === true ? 1 : 0
      const drakeStats = drakeStatsByTeam.get(teamNum) ?? initTeamDrakeStats()
      const elderKillsResolved = Math.max(readKills('elderDragon'), drakeStats.elderKills)

      const teamRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO agg_team_core_stats (
          id, team, rank_tier, game_version, count_win, count_game,
          sum_baron_kills, count_baron_first, sum_dragon_kills, count_dragon_first,
          sum_tower_kills, count_tower_first, sum_horde_kills, count_horde_first,
          sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills, count_inhibitor_first,
          count_first_blood, sum_elder_kills,
          count_earth_drake, count_water_drake, count_wind_drake, count_fire_drake,
          count_hextec_drake, count_chem_drake,
          count_earth_drake_soul, count_water_drake_soul, count_wind_drake_soul, count_fire_drake_soul,
          count_hextec_drake_soul, count_chem_drake_soul,
          updated_at
        )
        VALUES (
          ${idCandidate}, ${teamNum}, ${matchRankTier}, ${gameVersion}, ${win}, 1,
          ${readKills('baron')}, ${readFirst('baron')}, ${readKills('dragon')}, ${readFirst('dragon')},
          ${readKills('tower')}, ${readFirst('tower')}, ${readKills('horde')}, ${readFirst('horde')},
          ${readKills('riftHerald')}, ${readFirst('riftHerald')}, ${readKills('inhibitor')}, ${inhibitorFirstResolved},
          ${readFirst('champion')}, ${elderKillsResolved},
          ${drakeStats.earthDrake}, ${drakeStats.waterDrake}, ${drakeStats.windDrake}, ${drakeStats.fireDrake},
          ${drakeStats.hextecDrake}, ${drakeStats.chemDrake},
          ${drakeStats.earthSoul}, ${drakeStats.waterSoul}, ${drakeStats.windSoul}, ${drakeStats.fireSoul},
          ${drakeStats.hextecSoul}, ${drakeStats.chemSoul},
          NOW()
        )
        ON CONFLICT (team, rank_tier, game_version) DO UPDATE
        SET count_game = agg_team_core_stats.count_game + EXCLUDED.count_game,
            count_win = agg_team_core_stats.count_win + EXCLUDED.count_win,
            sum_baron_kills = agg_team_core_stats.sum_baron_kills + EXCLUDED.sum_baron_kills,
            count_baron_first = agg_team_core_stats.count_baron_first + EXCLUDED.count_baron_first,
            sum_dragon_kills = agg_team_core_stats.sum_dragon_kills + EXCLUDED.sum_dragon_kills,
            count_dragon_first = agg_team_core_stats.count_dragon_first + EXCLUDED.count_dragon_first,
            sum_tower_kills = agg_team_core_stats.sum_tower_kills + EXCLUDED.sum_tower_kills,
            count_tower_first = agg_team_core_stats.count_tower_first + EXCLUDED.count_tower_first,
            sum_horde_kills = agg_team_core_stats.sum_horde_kills + EXCLUDED.sum_horde_kills,
            count_horde_first = agg_team_core_stats.count_horde_first + EXCLUDED.count_horde_first,
            sum_rift_herald_kills = agg_team_core_stats.sum_rift_herald_kills + EXCLUDED.sum_rift_herald_kills,
            count_rift_herald_first = agg_team_core_stats.count_rift_herald_first + EXCLUDED.count_rift_herald_first,
            sum_inhibitor_kills = agg_team_core_stats.sum_inhibitor_kills + EXCLUDED.sum_inhibitor_kills,
            count_inhibitor_first = agg_team_core_stats.count_inhibitor_first + EXCLUDED.count_inhibitor_first,
            count_first_blood = agg_team_core_stats.count_first_blood + EXCLUDED.count_first_blood,
            sum_elder_kills = agg_team_core_stats.sum_elder_kills + EXCLUDED.sum_elder_kills,
            count_earth_drake = agg_team_core_stats.count_earth_drake + EXCLUDED.count_earth_drake,
            count_water_drake = agg_team_core_stats.count_water_drake + EXCLUDED.count_water_drake,
            count_wind_drake = agg_team_core_stats.count_wind_drake + EXCLUDED.count_wind_drake,
            count_fire_drake = agg_team_core_stats.count_fire_drake + EXCLUDED.count_fire_drake,
            count_hextec_drake = agg_team_core_stats.count_hextec_drake + EXCLUDED.count_hextec_drake,
            count_chem_drake = agg_team_core_stats.count_chem_drake + EXCLUDED.count_chem_drake,
            count_earth_drake_soul = agg_team_core_stats.count_earth_drake_soul + EXCLUDED.count_earth_drake_soul,
            count_water_drake_soul = agg_team_core_stats.count_water_drake_soul + EXCLUDED.count_water_drake_soul,
            count_wind_drake_soul = agg_team_core_stats.count_wind_drake_soul + EXCLUDED.count_wind_drake_soul,
            count_fire_drake_soul = agg_team_core_stats.count_fire_drake_soul + EXCLUDED.count_fire_drake_soul,
            count_hextec_drake_soul = agg_team_core_stats.count_hextec_drake_soul + EXCLUDED.count_hextec_drake_soul,
            count_chem_drake_soul = agg_team_core_stats.count_chem_drake_soul + EXCLUDED.count_chem_drake_soul,
            updated_at = NOW()
        RETURNING id
      `
      const sideStatId = teamRows[0]?.id
      if (sideStatId == null) continue

      const objectiveBuckets = [
        ['baron', toObjectiveBucket(readKills('baron'))],
        ['dragon', toObjectiveBucket(readKills('dragon'))],
        ['elder', toObjectiveBucket(elderKillsResolved)],
        ['tower', toObjectiveBucket(readKills('tower'))],
        ['inhibitor', toObjectiveBucket(readKills('inhibitor'))],
        ['riftHerald', toObjectiveBucket(readKills('riftHerald'))],
        ['horde', toObjectiveBucket(readKills('horde'))],
        ['first_blood', toObjectiveBucket(readFirst('champion'))],
        ['earth_drake', toObjectiveBucket(drakeStats.earthDrake)],
        ['water_drake', toObjectiveBucket(drakeStats.waterDrake)],
        ['wind_drake', toObjectiveBucket(drakeStats.windDrake)],
        ['fire_drake', toObjectiveBucket(drakeStats.fireDrake)],
        ['hextec_drake', toObjectiveBucket(drakeStats.hextecDrake)],
        ['chem_drake', toObjectiveBucket(drakeStats.chemDrake)],
        ['earth_soul', toObjectiveBucket(drakeStats.earthSoul)],
        ['water_soul', toObjectiveBucket(drakeStats.waterSoul)],
        ['wind_soul', toObjectiveBucket(drakeStats.windSoul)],
        ['fire_soul', toObjectiveBucket(drakeStats.fireSoul)],
        ['hextec_soul', toObjectiveBucket(drakeStats.hextecSoul)],
        ['chem_soul', toObjectiveBucket(drakeStats.chemSoul)],
      ] as const
      for (const [objectiveKey, objectiveBucket] of objectiveBuckets) {
        await tx.$executeRaw`
          INSERT INTO agg_team_bucket (
            team_stat_id,
            objective_key,
            objective_bucket,
            count_win,
            count_game,
            updated_at
          )
          VALUES (
            ${sideStatId},
            ${objectiveKey},
            ${objectiveBucket},
            ${win},
            1,
            NOW()
          )
          ON CONFLICT (team_stat_id, objective_key, objective_bucket) DO UPDATE
          SET count_game = agg_team_bucket.count_game + EXCLUDED.count_game,
              count_win = agg_team_bucket.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }

      await tx.$executeRaw`
        WITH objective_bucket_rows AS (
          SELECT
            objective_key,
            objective_bucket,
            SUM(count_win)::int AS count_win,
            SUM(count_game - count_win)::int AS count_loss
          FROM agg_team_bucket
          WHERE team_stat_id = ${sideStatId}
          GROUP BY objective_key, objective_bucket
        ),
        objective_bucket_json AS (
          SELECT
            objective_key,
            COALESCE(
              jsonb_object_agg(objective_bucket::text, count_win ORDER BY objective_bucket)
                FILTER (WHERE count_win > 0),
              '{}'::jsonb
            ) AS win_json,
            COALESCE(
              jsonb_object_agg(objective_bucket::text, count_loss ORDER BY objective_bucket)
                FILTER (WHERE count_loss > 0),
              '{}'::jsonb
            ) AS loss_json
          FROM objective_bucket_rows
          GROUP BY objective_key
        ),
        objective_bucket_json_drake_total AS (
          SELECT
            COALESCE(
              jsonb_object_agg(objective_bucket::text, count_win ORDER BY objective_bucket)
                FILTER (WHERE count_win > 0),
              '{}'::jsonb
            ) AS win_json,
            COALESCE(
              jsonb_object_agg(objective_bucket::text, count_loss ORDER BY objective_bucket)
                FILTER (WHERE count_loss > 0),
              '{}'::jsonb
            ) AS loss_json
          FROM (
            SELECT
              objective_bucket,
              SUM(count_win)::int AS count_win,
              SUM(count_loss)::int AS count_loss
            FROM objective_bucket_rows
            WHERE objective_key IN ('dragon', 'elder')
            GROUP BY objective_bucket
          ) x
        )
        UPDATE agg_team_core_stats atc
        SET
          baron_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'baron'), '{}'::jsonb),
          baron_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'baron'), '{}'::jsonb),
          drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json_drake_total), '{}'::jsonb),
          drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json_drake_total), '{}'::jsonb),
          void_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'horde'), '{}'::jsonb),
          void_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'horde'), '{}'::jsonb),
          herald_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'riftHerald'), '{}'::jsonb),
          herald_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'riftHerald'), '{}'::jsonb),
          inhibitor_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'inhibitor'), '{}'::jsonb),
          inhibitor_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'inhibitor'), '{}'::jsonb),
          tower_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'tower'), '{}'::jsonb),
          tower_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'tower'), '{}'::jsonb),
          first_blood_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'first_blood'), '{}'::jsonb),
          first_blood_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'first_blood'), '{}'::jsonb),
          elder_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'elder'), '{}'::jsonb),
          elder_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'elder'), '{}'::jsonb),
          earth_drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'earth_drake'), '{}'::jsonb),
          earth_drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'earth_drake'), '{}'::jsonb),
          water_drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'water_drake'), '{}'::jsonb),
          water_drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'water_drake'), '{}'::jsonb),
          wind_drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'wind_drake'), '{}'::jsonb),
          wind_drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'wind_drake'), '{}'::jsonb),
          fire_drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'fire_drake'), '{}'::jsonb),
          fire_drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'fire_drake'), '{}'::jsonb),
          hextec_drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'hextec_drake'), '{}'::jsonb),
          hextec_drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'hextec_drake'), '{}'::jsonb),
          chem_drake_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'chem_drake'), '{}'::jsonb),
          chem_drake_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'chem_drake'), '{}'::jsonb),
          earth_soul_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'earth_soul'), '{}'::jsonb),
          earth_soul_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'earth_soul'), '{}'::jsonb),
          water_soul_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'water_soul'), '{}'::jsonb),
          water_soul_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'water_soul'), '{}'::jsonb),
          wind_soul_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'wind_soul'), '{}'::jsonb),
          wind_soul_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'wind_soul'), '{}'::jsonb),
          fire_soul_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'fire_soul'), '{}'::jsonb),
          fire_soul_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'fire_soul'), '{}'::jsonb),
          hextec_soul_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'hextec_soul'), '{}'::jsonb),
          hextec_soul_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'hextec_soul'), '{}'::jsonb),
          chem_soul_win_team = COALESCE((SELECT win_json FROM objective_bucket_json WHERE objective_key = 'chem_soul'), '{}'::jsonb),
          chem_soul_loose_team = COALESCE((SELECT loss_json FROM objective_bucket_json WHERE objective_key = 'chem_soul'), '{}'::jsonb),
          updated_at = NOW()
        WHERE atc.id = ${sideStatId}
      `

      for (const [banIdx, ban] of (team.bans ?? []).entries()) {
        const bannedChampionId = toSafeInt(ban.championId)
        if (bannedChampionId <= 0) continue
        const byPickOrder = bannerRoleFromPickOrder(
          (ban as { pickOrder?: number; pickTurn?: number }).pickOrder ??
            (ban as { pickOrder?: number; pickTurn?: number }).pickTurn ??
            (banIdx + 1)
        )
        const bannerRoleNorm =
          byPickOrder !== 'UNKNOWN'
            ? byPickOrder
            : (teamRoleByChampion.get(`${teamNum}|${bannedChampionId}`) ?? 'UNKNOWN')
        await tx.$executeRaw`
          INSERT INTO agg_champion_bans_by_banner (
            team_num, banner_role_norm, banned_champion_id, game_version, rank_tier, ban_count, updated_at
          )
          VALUES (${teamNum}, ${bannerRoleNorm}, ${bannedChampionId}, ${gameVersion}, ${matchRankTier}, 1, NOW())
          ON CONFLICT (team_num, banner_role_norm, banned_champion_id, game_version, rank_tier) DO UPDATE
          SET ban_count = agg_champion_bans_by_banner.ban_count + EXCLUDED.ban_count,
              updated_at = NOW()
        `
      }
    }

    await tx.$executeRaw`
      INSERT INTO tracked_matches (
        match_id,
        status,
        created_at,
        aggregate_status,
        aggregate_attempt_count,
        aggregate_last_error,
        aggregated_at,
        player1,
        player2,
        player3,
        player4,
        player5,
        player6,
        player7,
        player8,
        player9,
        player10
      )
      VALUES (
        ${trackedMatchId},
        'INGESTED',
        NOW(),
        'AGGREGATED',
        1,
        NULL,
        NOW(),
        ${trackedPlayerSlots[0]}::jsonb,
        ${trackedPlayerSlots[1]}::jsonb,
        ${trackedPlayerSlots[2]}::jsonb,
        ${trackedPlayerSlots[3]}::jsonb,
        ${trackedPlayerSlots[4]}::jsonb,
        ${trackedPlayerSlots[5]}::jsonb,
        ${trackedPlayerSlots[6]}::jsonb,
        ${trackedPlayerSlots[7]}::jsonb,
        ${trackedPlayerSlots[8]}::jsonb,
        ${trackedPlayerSlots[9]}::jsonb
      )
      ON CONFLICT (match_id) DO UPDATE
      SET status = 'INGESTED',
          aggregate_status = 'AGGREGATED',
          aggregate_attempt_count = tracked_matches.aggregate_attempt_count + 1,
          aggregate_last_error = NULL,
          aggregated_at = NOW(),
          player1 = EXCLUDED.player1,
          player2 = EXCLUDED.player2,
          player3 = EXCLUDED.player3,
          player4 = EXCLUDED.player4,
          player5 = EXCLUDED.player5,
          player6 = EXCLUDED.player6,
          player7 = EXCLUDED.player7,
          player8 = EXCLUDED.player8,
          player9 = EXCLUDED.player9,
          player10 = EXCLUDED.player10
    `

    await tx.$executeRaw`
      INSERT INTO active_patches (game_version, activated_at, is_current, games_number, game_number_max)
      VALUES (${gameVersion}, NOW(), true, 0, 1000000)
      ON CONFLICT (game_version) DO NOTHING
    `

    await tx.$executeRaw`
      UPDATE match_ingest_raw
      SET status = 'done',
          normalized_at = NOW(),
          processing_started_at = NULL,
          last_error = NULL,
          next_retry_at = NULL
      WHERE id = ${rawId}
    `
      }, rawAggregateTransactionOptions())
      break
    } catch (err) {
      if (attempt >= 3 || !isRetryableTxError(err)) throw err
      await new Promise((r) => setTimeout(r, attempt * 150))
    }
  }
}
