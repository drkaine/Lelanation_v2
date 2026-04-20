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
  tier?: string
  rankTier?: string
}

type RawTeam = {
  teamId?: number
  win?: boolean
  bans?: Array<{ championId?: number }>
  objectives?: Record<string, { first?: boolean; kills?: number }>
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
      teams?: RawTeam[]
    }
  }
  const gameVersion = normalizeGameVersion(infoAny.info?.gameVersion)
  const region = String(payload.region ?? '').trim().toLowerCase() || 'euw1'
  const bannedChampions = new Set<number>()
  for (const team of infoAny.info?.teams ?? []) {
    for (const ban of team.bans ?? []) {
      const bid = toSafeInt(ban.championId)
      if (bid > 0) bannedChampions.add(bid)
    }
  }

  await prisma.$transaction(async (tx) => {
    const resolvedRoles = resolveParticipantRoles(participants)
    const participantByTeamRole = new Map<string, RawParticipant[]>()
    const teamRoleByChampion = new Map<string, string>()
    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx]
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

    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx]
      const championId = toSafeInt(p.championId)
      if (championId <= 0) continue

      const wins = p.win === true ? 1 : 0
      const rankTier = normalizeRankTier(p)
      const role = resolvedRoles[idx] ?? roleFromPosition(p)
      if (!isAllowedRole(role)) continue
      const statId = coreStatId(championId, role, rankTier, gameVersion, region)
      const countBan = bannedChampions.has(championId) ? 1 : 0

      await tx.$executeRaw`
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
          ${statId},
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
        ON CONFLICT (id) DO UPDATE
        SET count_game = agg_champion_core_stats.count_game + EXCLUDED.count_game,
            count_win = agg_champion_core_stats.count_win + EXCLUDED.count_win,
            count_ban = agg_champion_core_stats.count_ban + EXCLUDED.count_ban,
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

    }

    const matchRankTier =
      participants.map((p) => normalizeRankTier(p)).find((t) => t !== 'UNRANKED') ?? 'UNRANKED'

    await tx.$executeRaw`
      INSERT INTO agg_match_outcome_stats (game_version, rank_tier, count_match, updated_at)
      VALUES (${gameVersion}, ${matchRankTier}, 1, NOW())
      ON CONFLICT (game_version, rank_tier) DO UPDATE
      SET count_match = agg_match_outcome_stats.count_match + EXCLUDED.count_match,
          updated_at = NOW()
    `

    for (let idx = 0; idx < participants.length; idx++) {
      const p = participants[idx]
      const championId = toSafeInt(p.championId)
      const teamNum = toSafeInt(p.teamId)
      if (championId <= 0 || (teamNum !== 100 && teamNum !== 200)) continue
      const role = resolvedRoles[idx] ?? roleFromPosition(p)
      if (!isAllowedRole(role)) continue
      const rankTier = normalizeRankTier(p)
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
      const id = teamCoreId(teamNum, matchRankTier, gameVersion)
      const objectives = team.objectives ?? {}
      const readKills = (k: string) => toSafeInt(objectives[k]?.kills)
      const readFirst = (k: string) => (objectives[k]?.first === true ? 1 : 0)
      const win = team.win === true ? 1 : 0

      await tx.$executeRaw`
        INSERT INTO agg_team_core_stats (
          id, team, rank_tier, game_version, count_win, count_game,
          sum_baron_kills, count_baron_first, sum_dragon_kills, count_dragon_first,
          sum_tower_kills, count_tower_first, sum_horde_kills, count_horde_first,
          sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills,
          count_first_blood, sum_elder_kills, updated_at
        )
        VALUES (
          ${id}, ${teamNum}, ${matchRankTier}, ${gameVersion}, ${win}, 1,
          ${readKills('baron')}, ${readFirst('baron')}, ${readKills('dragon')}, ${readFirst('dragon')},
          ${readKills('tower')}, ${readFirst('tower')}, ${readKills('horde')}, ${readFirst('horde')},
          ${readKills('riftHerald')}, ${readFirst('riftHerald')}, ${readKills('inhibitor')},
          ${readFirst('champion')}, ${readKills('elderDragon')}, NOW()
        )
        ON CONFLICT (id) DO UPDATE
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
            count_first_blood = agg_team_core_stats.count_first_blood + EXCLUDED.count_first_blood,
            sum_elder_kills = agg_team_core_stats.sum_elder_kills + EXCLUDED.sum_elder_kills,
            updated_at = NOW()
      `

      const sideStatId = teamCoreId(teamNum, matchRankTier, gameVersion)
      const objectiveBuckets = [
        ['baron', toObjectiveBucket(readKills('baron'))],
        ['dragon', toObjectiveBucket(readKills('dragon'))],
        ['elder', toObjectiveBucket(readKills('elderDragon'))],
        ['tower', toObjectiveBucket(readKills('tower'))],
        ['inhibitor', toObjectiveBucket(readKills('inhibitor'))],
        ['riftHerald', toObjectiveBucket(readKills('riftHerald'))],
        ['horde', toObjectiveBucket(readKills('horde'))],
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

      for (const ban of team.bans ?? []) {
        const bannedChampionId = toSafeInt(ban.championId)
        if (bannedChampionId <= 0) continue
        const bannerRoleNorm = teamRoleByChampion.get(`${teamNum}|${bannedChampionId}`) ?? 'UNKNOWN'
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

    await tx.$executeRaw`DELETE FROM match_ingest_raw WHERE id = ${rawId}`
  })
}
