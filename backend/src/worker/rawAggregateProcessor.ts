import { prisma } from '../db.js'
import type { MatchIngestQueuePayloadV1 } from './matchIngestQueue.js'
import { createHash } from 'node:crypto'

type RawParticipant = {
  puuid?: string
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

function normalizeRankTier(p: RawParticipant): string {
  const raw = (p.tier ?? p.rankTier ?? 'UNRANKED').toString().trim().toUpperCase()
  if (!raw || raw === 'UNRANKED') return 'UNRANKED'
  return raw.split('_')[0] || 'UNRANKED'
}

function normalizeGameVersion(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return 'unknown'
  const [major, minor] = s.split('.')
  if (!major || !minor) return s
  return `${major}.${minor}`
}

async function loadIngestRankTiersByPuuid(riotMatchId: string): Promise<Map<string, string>> {
  const rows = await prisma.$queryRaw<Array<{ puuid: string; rank_tier: string }>>`
    SELECT pl.puuid::text AS puuid,
           UPPER(TRIM(COALESCE(NULLIF(TRIM(imp.rank_tier), ''), 'UNRANKED'))) AS rank_tier
    FROM ingest_match_players imp
    INNER JOIN players pl ON pl.id = imp.player_id
    INNER JOIN ingest_matchs im ON im.id = imp.match_id
    WHERE im.riot_match_id = ${riotMatchId}
  `
  const m = new Map<string, string>()
  for (const r of rows) {
    const pu = String(r.puuid ?? '').trim().toLowerCase()
    const tier = String(r.rank_tier ?? 'UNRANKED').trim().toUpperCase()
    if (pu) m.set(pu, tier)
  }
  return m
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

type FlatParticipantMetric = { key: string; kind: 'number' | 'boolean'; value: number }

type ParticipantMetricAgg = {
  numericSums: Record<string, number>
  numericCounts: Record<string, number>
  boolTrueCounts: Record<string, number>
  boolCounts: Record<string, number>
}

const PARTICIPANT_METRIC_ROOT_SKIP = new Set([
  'puuid',
  'riotIdGameName',
  'riotIdTagline',
  'summonerId',
  'summonerName',
  'participantId',
  'championId',
  'championName',
  'teamId',
  'teamPosition',
  'individualPosition',
  'lane',
  'role',
  'perks',
  '_runes',
  '_shards',
  '_summonerSpells',
])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function walkParticipantMetrics(
  value: unknown,
  prefix: string,
  out: FlatParticipantMetric[],
  depth: number
): void {
  if (depth > 4) return
  if (typeof value === 'number' && Number.isFinite(value)) {
    out.push({ key: prefix, kind: 'number', value })
    return
  }
  if (typeof value === 'boolean') {
    out.push({ key: prefix, kind: 'boolean', value: value ? 1 : 0 })
    return
  }
  if (!isPlainObject(value)) return
  for (const [k, v] of Object.entries(value)) {
    if (!k) continue
    const key = prefix ? `${prefix}.${k}` : k
    walkParticipantMetrics(v, key, out, depth + 1)
  }
}

function buildParticipantMetricAgg(participant: RawParticipant): ParticipantMetricAgg {
  const root = participant as unknown as Record<string, unknown>
  const flat: FlatParticipantMetric[] = []
  for (const [k, v] of Object.entries(root)) {
    if (!k || PARTICIPANT_METRIC_ROOT_SKIP.has(k)) continue
    walkParticipantMetrics(v, k, flat, 0)
  }
  const numericSums: Record<string, number> = {}
  const numericCounts: Record<string, number> = {}
  const boolTrueCounts: Record<string, number> = {}
  const boolCounts: Record<string, number> = {}
  for (const m of flat) {
    if (m.kind === 'number') {
      numericSums[m.key] = (numericSums[m.key] ?? 0) + m.value
      numericCounts[m.key] = (numericCounts[m.key] ?? 0) + 1
    } else {
      boolTrueCounts[m.key] = (boolTrueCounts[m.key] ?? 0) + m.value
      boolCounts[m.key] = (boolCounts[m.key] ?? 0) + 1
    }
  }
  return { numericSums, numericCounts, boolTrueCounts, boolCounts }
}

function parseNumberMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}

function mergeNumberMaps(base: Record<string, number>, delta: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...base }
  for (const [k, v] of Object.entries(delta)) out[k] = (out[k] ?? 0) + v
  return out
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

function toDurationBucket(gameDurationSeconds: number): number {
  if (!Number.isFinite(gameDurationSeconds) || gameDurationSeconds <= 0) return 0
  return Math.max(0, Math.trunc(gameDurationSeconds / 60))
}

function bannerRoleFromPickOrder(pickOrderRaw: unknown): string {
  const pickOrder = toSafeInt(pickOrderRaw)
  if (pickOrder === 1) return 'TOP'
  if (pickOrder === 2) return 'JUNGLE'
  if (pickOrder === 3) return 'MIDDLE'
  if (pickOrder === 4) return 'BOTTOM'
  if (pickOrder === 5) return 'SUPPORT'
  return 'UNKNOWN'
}

function isRetryableTxError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('40P01') || message.toLowerCase().includes('deadlock detected')
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
  const durationBucket = toDurationBucket(toSafeInt(infoAny.info?.gameDuration))
  const region = String(payload.region ?? '').trim().toLowerCase() || 'euw1'
  const bannedChampions = new Set<number>()
  for (const team of infoAny.info?.teams ?? []) {
    for (const ban of team.bans ?? []) {
      const bid = toSafeInt(ban.championId)
      if (bid > 0) bannedChampions.add(bid)
    }
  }

  const dbRankByPuuid = await loadIngestRankTiersByPuuid(trackedMatchId)
  const participantsForAgg = mergeParticipantTiersFromDb(participants, dbRankByPuuid)
  const drakeStatsByTeam = extractTeamDrakeStatsByTeam(payload)

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
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
          count_game,
          updated_at
        )
        VALUES (
          ${statId},
          ${physToChamps},
          ${magicToChamps},
          ${trueToChamps},
          ${totalToChamps},
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
          count_game = agg_champion_damage_stats.count_game + EXCLUDED.count_game,
          updated_at = NOW()
      `
      const participantMetricAgg = buildParticipantMetricAgg(p)
      const existingMetricRows = await tx.$queryRaw<
        Array<{
          numeric_sums: unknown
          numeric_counts: unknown
          bool_true_counts: unknown
          bool_counts: unknown
        }>
      >`
        SELECT
          numeric_sums,
          numeric_counts,
          bool_true_counts,
          bool_counts
        FROM agg_champion_participant_stats
        WHERE champion_stat_id = ${statId}
        FOR UPDATE
      `
      const existingMetricRow = existingMetricRows[0]
      const mergedNumericSums = mergeNumberMaps(
        parseNumberMap(existingMetricRow?.numeric_sums),
        participantMetricAgg.numericSums
      )
      const mergedNumericCounts = mergeNumberMaps(
        parseNumberMap(existingMetricRow?.numeric_counts),
        participantMetricAgg.numericCounts
      )
      const mergedBoolTrueCounts = mergeNumberMaps(
        parseNumberMap(existingMetricRow?.bool_true_counts),
        participantMetricAgg.boolTrueCounts
      )
      const mergedBoolCounts = mergeNumberMaps(
        parseNumberMap(existingMetricRow?.bool_counts),
        participantMetricAgg.boolCounts
      )
      await tx.$executeRaw`
        INSERT INTO agg_champion_participant_stats (
          champion_stat_id,
          numeric_sums,
          numeric_counts,
          bool_true_counts,
          bool_counts,
          updated_at
        )
        VALUES (
          ${statId},
          ${JSON.stringify(mergedNumericSums)}::jsonb,
          ${JSON.stringify(mergedNumericCounts)}::jsonb,
          ${JSON.stringify(mergedBoolTrueCounts)}::jsonb,
          ${JSON.stringify(mergedBoolCounts)}::jsonb,
          NOW()
        )
        ON CONFLICT (champion_stat_id) DO UPDATE
        SET
          numeric_sums = EXCLUDED.numeric_sums,
          numeric_counts = EXCLUDED.numeric_counts,
          bool_true_counts = EXCLUDED.bool_true_counts,
          bool_counts = EXCLUDED.bool_counts,
          updated_at = NOW()
      `

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
            NOW()
          )
          ON CONFLICT (champion_stat_id, opponent_champion_id) DO UPDATE
          SET count_game = agg_champion_vs_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_vs_stats.count_win + EXCLUDED.count_win,
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
            updated_at
          )
          VALUES (
            ${statId},
            ${allyChampionId},
            ${allyRole},
            ${wins},
            1,
            NOW()
          )
          ON CONFLICT (champion_stat_id, ally_champion_id, ally_role) DO UPDATE
          SET count_game = agg_champion_duo_role_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_duo_role_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
        await tx.$executeRaw`
          INSERT INTO agg_champion_duo_stats (
            champion_stat_id,
            ally_champion_id,
            count_win,
            count_game,
            updated_at
          )
          VALUES (
            ${statId},
            ${allyChampionId},
            ${wins},
            1,
            NOW()
          )
          ON CONFLICT (champion_stat_id, ally_champion_id) DO UPDATE
          SET count_game = agg_champion_duo_stats.count_game + EXCLUDED.count_game,
              count_win = agg_champion_duo_stats.count_win + EXCLUDED.count_win,
              updated_at = NOW()
        `
      }

      await tx.$executeRaw`
        INSERT INTO agg_champion_bucket (
          champion_stat_id,
          duration_bucket,
          count_win,
          count_game,
          updated_at
        )
        VALUES (
          ${statId},
          ${durationBucket},
          ${wins},
          1,
          NOW()
        )
        ON CONFLICT (champion_stat_id, duration_bucket) DO UPDATE
        SET count_game = agg_champion_bucket.count_game + EXCLUDED.count_game,
            count_win = agg_champion_bucket.count_win + EXCLUDED.count_win,
            updated_at = NOW()
      `

      const spellD = toSafeInt((p as RawParticipant).summoner1Id)
      const spellF = toSafeInt((p as RawParticipant).summoner2Id)
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

      const { runes, shards, stylesByRune } = extractRunesAndShards(p)
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
        const style = stylesByRune.get(runeId) ?? ''
        await tx.$executeRaw`
          INSERT INTO agg_champion_runes_solo_stats (
            champion_stat_id,
            perk_id,
            style,
            count_win,
            count_game,
            updated_at
          )
          VALUES (${statId}, ${runeId}, ${style}, ${wins}, 1, NOW())
          ON CONFLICT (champion_stat_id, perk_id, style) DO UPDATE
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

      for (const itemId of finalItems) {
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
          VALUES (${statId}, ${itemId}, 0, 0, 1, ${wins}, 1, 0, NOW())
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

    const pairRows = await tx.$queryRaw<
      Array<{ rank_tier: string; role_norm: string; champion_id: number; spell_d: number; spell_f: number; count_game: bigint; count_win: bigint }>
    >`
      SELECT
        COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') AS rank_tier,
        UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')) AS role_norm,
        imp.champion_id,
        imp.summoner_spells[1]::int AS spell_d,
        imp.summoner_spells[2]::int AS spell_f,
        COUNT(*)::bigint AS count_game,
        SUM(CASE WHEN it.win THEN 1 ELSE 0 END)::bigint AS count_win
      FROM ingest_match_players imp
      INNER JOIN ingest_matchs im ON im.id = imp.match_id
      INNER JOIN ingest_teams it ON it.id = imp.team_id
      WHERE im.riot_match_id = ${trackedMatchId}
        AND cardinality(imp.summoner_spells) >= 2
        AND COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
        AND UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')) IN ('TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT')
      GROUP BY
        COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED'),
        UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')),
        imp.champion_id,
        imp.summoner_spells[1],
        imp.summoner_spells[2]
    `
    for (const r of pairRows) {
      await tx.$executeRaw`
        INSERT INTO agg_champion_summoner_spell_pair_stats (
          game_version, rank_tier, role_norm, champion_id, spell_d, spell_f, count_game, count_win, updated_at
        )
        VALUES (
          ${gameVersion}, ${r.rank_tier}, ${r.role_norm}, ${r.champion_id}, ${r.spell_d}, ${r.spell_f},
          ${Number(r.count_game ?? 0)}, ${Number(r.count_win ?? 0)}, NOW()
        )
        ON CONFLICT (game_version, rank_tier, role_norm, champion_id, spell_d, spell_f) DO UPDATE
        SET count_game = agg_champion_summoner_spell_pair_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_summoner_spell_pair_stats.count_win + EXCLUDED.count_win,
            updated_at = NOW()
      `
    }

    const starterRows = await tx.$queryRaw<
      Array<{ rank_tier: string; role_norm: string; champion_id: number; starter_key: string; count_game: bigint; count_win: bigint }>
    >`
      WITH starter_rows AS (
        SELECT
          COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') AS rank_tier,
          UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')) AS role_norm,
          imp.champion_id,
          it.win,
          COALESCE(
            (
              SELECT '[' || string_agg((e ->> 'itemId')::text, ',' ORDER BY (e ->> 'order')::int, (e ->> 'timestampMs')::bigint) || ']'
              FROM jsonb_array_elements(COALESCE(imp.items::jsonb, '[]'::jsonb)) AS e
              WHERE COALESCE((e ->> 'starter')::boolean, false)
                AND (e ->> 'itemId')::int NOT IN (
                  3340, 3364, 3363, 2055,
                  2003, 2009, 2010, 2031, 2032, 2033, 2060, 2138, 2139, 2140
                )
            ),
            '[]'
          ) AS starter_key
        FROM ingest_match_players imp
        INNER JOIN ingest_matchs im ON im.id = imp.match_id
        INNER JOIN ingest_teams it ON it.id = imp.team_id
        WHERE im.riot_match_id = ${trackedMatchId}
          AND COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(im.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'
          AND UPPER(COALESCE(NULLIF(TRIM(imp.role), ''), 'UNKNOWN')) IN ('TOP','JUNGLE','MIDDLE','BOTTOM','SUPPORT')
      )
      SELECT
        rank_tier, role_norm, champion_id, starter_key,
        COUNT(*)::bigint AS count_game,
        SUM(CASE WHEN win THEN 1 ELSE 0 END)::bigint AS count_win
      FROM starter_rows
      WHERE starter_key <> '[]'
      GROUP BY rank_tier, role_norm, champion_id, starter_key
    `
    for (const r of starterRows) {
      await tx.$executeRaw`
        INSERT INTO agg_champion_item_starter_set_stats (
          game_version, rank_tier, role_norm, champion_id, starter_key, count_game, count_win, updated_at
        )
        VALUES (
          ${gameVersion}, ${r.rank_tier}, ${r.role_norm}, ${r.champion_id}, ${r.starter_key},
          ${Number(r.count_game ?? 0)}, ${Number(r.count_win ?? 0)}, NOW()
        )
        ON CONFLICT (game_version, rank_tier, role_norm, champion_id, starter_key) DO UPDATE
        SET count_game = agg_champion_item_starter_set_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_item_starter_set_stats.count_win + EXCLUDED.count_win,
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
      await tx.$executeRaw`
        INSERT INTO agg_champion_side_stats (
          team_num,
          champion_id,
          role_norm,
          game_version,
          rank_tier,
          count_win,
          count_game,
          updated_at
        )
        VALUES (${teamNum}, ${championId}, ${role}, ${gameVersion}, ${rankTier}, ${wins}, 1, NOW())
        ON CONFLICT (team_num, champion_id, role_norm, game_version, rank_tier) DO UPDATE
        SET count_game = agg_champion_side_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_side_stats.count_win + EXCLUDED.count_win,
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
          ${readKills('riftHerald')}, ${readFirst('riftHerald')}, ${readKills('inhibitor')}, ${readFirst('inhibitor')},
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

      for (const ban of team.bans ?? []) {
        const bannedChampionId = toSafeInt(ban.championId)
        if (bannedChampionId <= 0) continue
        const byPickOrder = bannerRoleFromPickOrder(
          (ban as { pickOrder?: number; pickTurn?: number }).pickOrder ??
            (ban as { pickOrder?: number; pickTurn?: number }).pickTurn
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
      UPDATE tracked_matches
      SET status = 'INGESTED'
      WHERE match_id = ${trackedMatchId}
    `

    await tx.$executeRaw`
      INSERT INTO active_patches (game_version, activated_at, is_current, games_number, game_number_max)
      VALUES (${gameVersion}, NOW(), true, 0, 1000000)
      ON CONFLICT (game_version) DO NOTHING
    `

    // Ingest lean is only a staging area for this pipeline; counts/UI patches come from agg + sync.
    await tx.$executeRaw`
      DELETE FROM ingest_matchs
      WHERE riot_match_id = ${trackedMatchId}
    `

    await tx.$executeRaw`
      DELETE FROM match_ingest_raw
      WHERE id = ${rawId}
    `
      })
      break
    } catch (err) {
      if (attempt >= 3 || !isRetryableTxError(err)) throw err
      await new Promise((r) => setTimeout(r, attempt * 150))
    }
  }
}
