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

      const teamRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO agg_team_core_stats (
          id, team, rank_tier, game_version, count_win, count_game,
          sum_baron_kills, count_baron_first, sum_dragon_kills, count_dragon_first,
          sum_tower_kills, count_tower_first, sum_horde_kills, count_horde_first,
          sum_rift_herald_kills, count_rift_herald_first, sum_inhibitor_kills,
          count_first_blood, sum_elder_kills, updated_at
        )
        VALUES (
          ${idCandidate}, ${teamNum}, ${matchRankTier}, ${gameVersion}, ${win}, 1,
          ${readKills('baron')}, ${readFirst('baron')}, ${readKills('dragon')}, ${readFirst('dragon')},
          ${readKills('tower')}, ${readFirst('tower')}, ${readKills('horde')}, ${readFirst('horde')},
          ${readKills('riftHerald')}, ${readFirst('riftHerald')}, ${readKills('inhibitor')},
          ${readFirst('champion')}, ${readKills('elderDragon')}, NOW()
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
            count_first_blood = agg_team_core_stats.count_first_blood + EXCLUDED.count_first_blood,
            sum_elder_kills = agg_team_core_stats.sum_elder_kills + EXCLUDED.sum_elder_kills,
            updated_at = NOW()
        RETURNING id
      `
      const sideStatId = teamRows[0]?.id
      if (sideStatId == null) continue

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
