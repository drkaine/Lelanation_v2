/**
 * StatsAggregationService
 *
 * Incrementally aggregates raw match data into the aggregate tables:
 * - champion_core_stats (and linked sub-tables)
 * - champion_vs_stats
 * - team_core_stats
 * - champion_item_stats / champion_item_solo_stats
 * - champion_runes_stats / champion_runes_solo_stats / champion_shard_solo_stats
 * - champion_summoner_spell_agg
 * - champion_bucket
 *
 * Each match is processed once, then its aggregatedAt is set.
 * This ensures idempotency: re-running will skip already-processed matches.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadMatchFilters } from './RiotConfigService.js'

const BATCH_SIZE = 50

type LoggerType = ReturnType<typeof createRiotPollerLogger>

/**
 * Process a batch of unprocessed matches and update aggregate tables.
 * Returns the number of matches processed.
 */
export async function aggregatePendingMatches(
  logger?: LoggerType
): Promise<number> {
  if (!isDatabaseConfigured()) return 0

  const matches = await prisma.match.findMany({
    where: { aggregatedAt: null },
    orderBy: { id: 'asc' },
    take: BATCH_SIZE,
    select: {
      id: true,
      riotMatchId: true,
      gameVersion: true,
      rankTier: true,
      rankDivision: true,
      gameDuration: true,
      gameEndedInSurrender: true,
      gameEndedInEarlySurrender: true,
      region: true,
      teams: {
        select: {
          id: true,
          team: true,
          win: true,
          teamEarlySurrendered: true,
          baronKills: true, baronFirst: true,
          dragonKills: true, dragonFirst: true,
          towerKills: true, towerFirst: true,
          hordeKills: true, hordeFirst: true,
          riftHeraldKills: true, riftHeraldFirst: true,
          inhibitorKills: true, championKills: true,
          firstBlood: true, elderKills: true,
          bans: { select: { championId: true } },
        },
      },
      matchPlayers: {
        select: {
          id: true,
          championId: true,
          role: true,
          rankTier: true,
          rankDivision: true,
          team: { select: { team: true, win: true, teamEarlySurrendered: true } },
          core: {
            select: {
              kills: true, deaths: true, assists: true, champLevel: true,
              champExperience: true, goldEarned: true, goldSpent: true,
              totalMinionsKilled: true, consumablesPurchased: true, itemsPurchased: true,
            },
          },
          items: { select: { itemId: true, starter: true, core: true, timestampMs: true, order: true } },
          runes: { select: { perkId: true, style: true } },
          shards: { select: { shardId: true, slot: true } },
          summonerSpells: { select: { spellId: true, spellSlot: true } },
          buckets: {
            select: {
              durationBucket: true,
              magicDamageDone: true, magicDamageDoneToChampion: true, magicDamageTaken: true,
              physicalDamageDone: true, physicalDamageDoneToChampion: true, physicalDamageTaken: true,
              totalDamageDone: true, totalDamageDoneToChampion: true, totalDamageTaken: true,
              trueDamageDone: true, trueDamageDoneToChampion: true, trueDamageTaken: true,
              goldPerSecond: true, currentGold: true,
            },
          },
        },
      },
    },
  })

  if (matches.length === 0) return 0

  let processed = 0
  for (const match of matches) {
    try {
      await aggregateMatch(match)
      await prisma.match.update({
        where: { id: match.id },
        data: { aggregatedAt: new Date() },
      })
      processed++
    } catch (err) {
      if (logger) void logger.error('Aggregation failed for match', err, { riotMatchId: match.riotMatchId })
    }
  }

  if (logger && processed > 0) {
    void logger.step('Aggregation: batch processed', { processed, total: matches.length })
  }
  return processed
}

/**
 * Run aggregation until all pending matches are processed.
 */
export async function runFullAggregation(logger?: LoggerType): Promise<void> {
  if (!isDatabaseConfigured()) return
  let total = 0
  while (true) {
    const done = await aggregatePendingMatches(logger)
    total += done
    if (done < BATCH_SIZE) break
  }
  if (logger && total > 0) {
    void logger.step('Aggregation: full run complete', { total })
  }
}

interface TeamForAgg {
  id: bigint
  team: number
  win: boolean
  teamEarlySurrendered: boolean
  baronKills: number; baronFirst: boolean
  dragonKills: number; dragonFirst: boolean
  towerKills: number; towerFirst: boolean
  hordeKills: number; hordeFirst: boolean
  riftHeraldKills: number; riftHeraldFirst: boolean
  inhibitorKills: number; championKills: number
  firstBlood: boolean; elderKills: number
  bans: Array<{ championId: number }>
}

interface MatchPlayerForAgg {
  id: bigint
  championId: number
  role: string
  rankTier: string
  rankDivision: string | null
  team: { team: number; win: boolean; teamEarlySurrendered: boolean } | null
  core: {
    kills: number; deaths: number; assists: number; champLevel: number
    champExperience: number; goldEarned: number; goldSpent: number
    totalMinionsKilled: number; consumablesPurchased: number; itemsPurchased: number
  } | null
  items: Array<{ itemId: number; starter: boolean; core: boolean; timestampMs: number; order: number }>
  runes: Array<{ perkId: number; style: number }>
  shards: Array<{ shardId: number; slot: number }>
  summonerSpells: Array<{ spellId: number; spellSlot: number }>
  buckets: Array<{
    durationBucket: number
    magicDamageDone: number; magicDamageDoneToChampion: number; magicDamageTaken: number
    physicalDamageDone: number; physicalDamageDoneToChampion: number; physicalDamageTaken: number
    totalDamageDone: number; totalDamageDoneToChampion: number; totalDamageTaken: number
    trueDamageDone: number; trueDamageDoneToChampion: number; trueDamageTaken: number
    goldPerSecond: number; currentGold: number
  }>
}

interface MatchForAgg {
  id: bigint
  riotMatchId: string
  gameVersion: string
  rankTier: string
  rankDivision: string
  gameDuration: number
  gameEndedInSurrender: boolean
  gameEndedInEarlySurrender: boolean
  region: string
  teams: TeamForAgg[]
  matchPlayers: MatchPlayerForAgg[]
}

async function aggregateMatch(match: MatchForAgg): Promise<void> {
  const { gameVersion, rankTier, rankDivision, region, gameDuration } = match

  // ── Team core stats ────────────────────────────────────────────────────────
  for (const team of match.teams) {
    const win = team.win ? 1 : 0
    const teamRankDiv = rankDivision ?? ''
    await prisma.$executeRaw`
      INSERT INTO team_core_stats
        (team, rank_tier, rank_division, game_version, region,
         count_win, count_game, count_team_early_surrendered,
         sum_baron_kills, count_baron_first,
         sum_dragon_kills, count_dragon_first,
         sum_tower_kills, count_tower_first,
         sum_horde_kills, count_horde_first,
         sum_rift_herald_kills, count_rift_herald_first,
         sum_inhibitor_kills, sum_champion_kills,
         count_first_blood, sum_elder_kills)
      VALUES (
        ${team.team}, ${rankTier}, ${teamRankDiv}, ${gameVersion}, ${region},
        ${win}, 1, ${team.teamEarlySurrendered ? 1 : 0},
        ${team.baronKills}, ${team.baronFirst ? 1 : 0},
        ${team.dragonKills}, ${team.dragonFirst ? 1 : 0},
        ${team.towerKills}, ${team.towerFirst ? 1 : 0},
        ${team.hordeKills}, ${team.hordeFirst ? 1 : 0},
        ${team.riftHeraldKills}, ${team.riftHeraldFirst ? 1 : 0},
        ${team.inhibitorKills}, ${team.championKills},
        ${team.firstBlood ? 1 : 0}, ${team.elderKills}
      )
      ON CONFLICT (team, rank_tier, rank_division, game_version, region)
      DO UPDATE SET
        count_win = team_core_stats.count_win + EXCLUDED.count_win,
        count_game = team_core_stats.count_game + 1,
        count_team_early_surrendered = team_core_stats.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
        sum_baron_kills = team_core_stats.sum_baron_kills + EXCLUDED.sum_baron_kills,
        count_baron_first = team_core_stats.count_baron_first + EXCLUDED.count_baron_first,
        sum_dragon_kills = team_core_stats.sum_dragon_kills + EXCLUDED.sum_dragon_kills,
        count_dragon_first = team_core_stats.count_dragon_first + EXCLUDED.count_dragon_first,
        sum_tower_kills = team_core_stats.sum_tower_kills + EXCLUDED.sum_tower_kills,
        count_tower_first = team_core_stats.count_tower_first + EXCLUDED.count_tower_first,
        sum_horde_kills = team_core_stats.sum_horde_kills + EXCLUDED.sum_horde_kills,
        count_horde_first = team_core_stats.count_horde_first + EXCLUDED.count_horde_first,
        sum_rift_herald_kills = team_core_stats.sum_rift_herald_kills + EXCLUDED.sum_rift_herald_kills,
        count_rift_herald_first = team_core_stats.count_rift_herald_first + EXCLUDED.count_rift_herald_first,
        sum_inhibitor_kills = team_core_stats.sum_inhibitor_kills + EXCLUDED.sum_inhibitor_kills,
        sum_champion_kills = team_core_stats.sum_champion_kills + EXCLUDED.sum_champion_kills,
        count_first_blood = team_core_stats.count_first_blood + EXCLUDED.count_first_blood,
        sum_elder_kills = team_core_stats.sum_elder_kills + EXCLUDED.sum_elder_kills
    `
  }

  // ── Champion ban aggregation ───────────────────────────────────────────────
  // Collect all banned champion IDs in this match
  const bannedChampionIds = new Set<number>()
  for (const team of match.teams) {
    for (const ban of team.bans) {
      if (ban.championId > 0) bannedChampionIds.add(ban.championId)
    }
  }

  // ── Per-player aggregation ─────────────────────────────────────────────────
  for (const mp of match.matchPlayers) {
    const win = mp.team?.win ? 1 : 0
    const riotTeam = mp.team?.team ?? 100
    const playerRankTier = mp.rankTier || rankTier
    const playerRankDiv = mp.rankDivision ?? rankDivision ?? ''
    const core = mp.core

    // Upsert champion_core_stats
    const [coreStatRow] = await prisma.$queryRaw<Array<{ id: bigint }>>`
      INSERT INTO champion_core_stats
        (champion_id, rank_tier, rank_division, game_version, role, region,
         count_win, count_game, sum_game_duration,
         count_team_100, count_team_200,
         count_game_ended_in_surrender, count_game_ended_in_early_surrender,
         count_team_early_surrendered, count_ban,
         sum_kills, sum_deaths, sum_assists,
         sum_champ_level, sum_champ_experience,
         sum_gold_earned, sum_gold_spent,
         sum_total_minions_killed, sum_consumables_purchased, sum_items_purchased)
      VALUES (
        ${mp.championId}, ${playerRankTier}, ${playerRankDiv}, ${gameVersion}, ${mp.role}, ${region},
        ${win}, 1, ${BigInt(gameDuration)},
        ${riotTeam === 100 ? 1 : 0}, ${riotTeam === 200 ? 1 : 0},
        ${match.gameEndedInSurrender ? 1 : 0},
        ${match.gameEndedInEarlySurrender ? 1 : 0},
        ${mp.team?.teamEarlySurrendered ? 1 : 0},
        ${bannedChampionIds.has(mp.championId) ? 1 : 0},
        ${BigInt(core?.kills ?? 0)}, ${BigInt(core?.deaths ?? 0)}, ${BigInt(core?.assists ?? 0)},
        ${BigInt(core?.champLevel ?? 0)}, ${BigInt(core?.champExperience ?? 0)},
        ${BigInt(core?.goldEarned ?? 0)}, ${BigInt(core?.goldSpent ?? 0)},
        ${BigInt(core?.totalMinionsKilled ?? 0)},
        ${BigInt(core?.consumablesPurchased ?? 0)},
        ${BigInt(core?.itemsPurchased ?? 0)}
      )
      ON CONFLICT (champion_id, rank_tier, rank_division, game_version, role, region)
      DO UPDATE SET
        count_win = champion_core_stats.count_win + EXCLUDED.count_win,
        count_game = champion_core_stats.count_game + 1,
        sum_game_duration = champion_core_stats.sum_game_duration + EXCLUDED.sum_game_duration,
        count_team_100 = champion_core_stats.count_team_100 + EXCLUDED.count_team_100,
        count_team_200 = champion_core_stats.count_team_200 + EXCLUDED.count_team_200,
        count_game_ended_in_surrender = champion_core_stats.count_game_ended_in_surrender + EXCLUDED.count_game_ended_in_surrender,
        count_game_ended_in_early_surrender = champion_core_stats.count_game_ended_in_early_surrender + EXCLUDED.count_game_ended_in_early_surrender,
        count_team_early_surrendered = champion_core_stats.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
        count_ban = champion_core_stats.count_ban + EXCLUDED.count_ban,
        sum_kills = champion_core_stats.sum_kills + EXCLUDED.sum_kills,
        sum_deaths = champion_core_stats.sum_deaths + EXCLUDED.sum_deaths,
        sum_assists = champion_core_stats.sum_assists + EXCLUDED.sum_assists,
        sum_champ_level = champion_core_stats.sum_champ_level + EXCLUDED.sum_champ_level,
        sum_champ_experience = champion_core_stats.sum_champ_experience + EXCLUDED.sum_champ_experience,
        sum_gold_earned = champion_core_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
        sum_gold_spent = champion_core_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
        sum_total_minions_killed = champion_core_stats.sum_total_minions_killed + EXCLUDED.sum_total_minions_killed,
        sum_consumables_purchased = champion_core_stats.sum_consumables_purchased + EXCLUDED.sum_consumables_purchased,
        sum_items_purchased = champion_core_stats.sum_items_purchased + EXCLUDED.sum_items_purchased
      RETURNING id
    `

    if (!coreStatRow) continue
    const coreStatId = coreStatRow.id

    // ── Opponent stats (champion_vs_stats) ─────────────────────────────────
    // Opponents = players on the other team
    const opponentChampions = match.matchPlayers
      .filter(op => op.id !== mp.id && op.team?.team !== riotTeam)
      .map(op => op.championId)

    for (const oppChampId of opponentChampions) {
      await prisma.$executeRaw`
        INSERT INTO champion_vs_stats (champion_stat_id, opponent_champion_id, count_win, count_game)
        VALUES (${coreStatId}, ${oppChampId}, ${win}, 1)
        ON CONFLICT (champion_stat_id, opponent_champion_id)
        DO UPDATE SET
          count_win = champion_vs_stats.count_win + EXCLUDED.count_win,
          count_game = champion_vs_stats.count_game + 1
      `
    }

    // ── Items ──────────────────────────────────────────────────────────────
    // Build item list (order 0-5 non-zero, exclude slot 6 which is trinket-ish)
    const coreItems = mp.items
      .filter(i => i.order < 6 && i.itemId > 0)
      .sort((a, b) => a.order - b.order)
      .map(i => i.itemId)

    if (coreItems.length > 0) {
      const itemList = JSON.stringify(coreItems)
      const avgTs = mp.items.length > 0
        ? Math.round(mp.items.filter(i => i.order < 6).reduce((s, i) => s + i.timestampMs, 0) / Math.max(1, mp.items.filter(i => i.order < 6).length))
        : 0

      await prisma.$executeRaw`
        INSERT INTO champion_item_stats (champion_stat_id, item_list, count_win, count_game, sum_timestamp_ms)
        VALUES (${coreStatId}, ${itemList}, ${win}, 1, ${avgTs})
        ON CONFLICT (champion_stat_id, item_list)
        DO UPDATE SET
          count_win = champion_item_stats.count_win + EXCLUDED.count_win,
          count_game = champion_item_stats.count_game + 1,
          sum_timestamp_ms = champion_item_stats.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms
      `
    }

    // Solo items
    for (const item of mp.items.filter(i => i.itemId > 0)) {
      await prisma.$executeRaw`
        INSERT INTO champion_item_solo_stats
          (champion_stat_id, item_id, count_starter, count_core, count_win, count_game, sum_timestamp_ms)
        VALUES
          (${coreStatId}, ${item.itemId},
           ${item.starter ? 1 : 0}, ${item.core ? 1 : 0},
           ${win}, 1, ${item.timestampMs})
        ON CONFLICT (champion_stat_id, item_id)
        DO UPDATE SET
          count_starter = champion_item_solo_stats.count_starter + EXCLUDED.count_starter,
          count_core = champion_item_solo_stats.count_core + EXCLUDED.count_core,
          count_win = champion_item_solo_stats.count_win + EXCLUDED.count_win,
          count_game = champion_item_solo_stats.count_game + 1,
          sum_timestamp_ms = champion_item_solo_stats.sum_timestamp_ms + EXCLUDED.sum_timestamp_ms
      `
    }

    // ── Runes ──────────────────────────────────────────────────────────────
    if (mp.runes.length > 0) {
      const runeIds = mp.runes.map(r => r.perkId).sort((a, b) => a - b)
      const runeList = JSON.stringify(runeIds)

      await prisma.$executeRaw`
        INSERT INTO champion_runes_stats (champion_stat_id, rune_list, count_win, count_game)
        VALUES (${coreStatId}, ${runeList}, ${win}, 1)
        ON CONFLICT (champion_stat_id, rune_list)
        DO UPDATE SET
          count_win = champion_runes_stats.count_win + EXCLUDED.count_win,
          count_game = champion_runes_stats.count_game + 1
      `

      for (const rune of mp.runes) {
        await prisma.$executeRaw`
          INSERT INTO champion_runes_solo_stats (champion_stat_id, perk_id, style, count_win, count_game)
          VALUES (${coreStatId}, ${rune.perkId}, ${rune.style}, ${win}, 1)
          ON CONFLICT (champion_stat_id, perk_id)
          DO UPDATE SET
            count_win = champion_runes_solo_stats.count_win + EXCLUDED.count_win,
            count_game = champion_runes_solo_stats.count_game + 1
        `
      }
    }

    // ── Shards ─────────────────────────────────────────────────────────────
    if (mp.shards.length > 0) {
      const shardList = JSON.stringify(mp.shards.sort((a, b) => a.slot - b.slot).map(s => s.shardId))

      await prisma.$executeRaw`
        INSERT INTO champion_shard_stats (champion_stat_id, shard_list, count_win, count_game)
        VALUES (${coreStatId}, ${shardList}, ${win}, 1)
        ON CONFLICT (champion_stat_id, shard_list)
        DO UPDATE SET
          count_win = champion_shard_stats.count_win + EXCLUDED.count_win,
          count_game = champion_shard_stats.count_game + 1
      `

      for (const shard of mp.shards) {
        await prisma.$executeRaw`
          INSERT INTO champion_shard_solo_stats (champion_stat_id, shard_id, slot, count_win, count_game)
          VALUES (${coreStatId}, ${shard.shardId}, ${shard.slot}, ${win}, 1)
          ON CONFLICT (champion_stat_id, shard_id)
          DO UPDATE SET
            count_win = champion_shard_solo_stats.count_win + EXCLUDED.count_win,
            count_game = champion_shard_solo_stats.count_game + 1
        `
      }
    }

    // ── Summoner spells ────────────────────────────────────────────────────
    for (const ss of mp.summonerSpells) {
      await prisma.$executeRaw`
        INSERT INTO champion_summoner_spells
          (champion_stat_id, spell_id, count_win, count_game, count_slot0, count_slot1)
        VALUES
          (${coreStatId}, ${ss.spellId}, ${win}, 1,
           ${ss.spellSlot === 0 ? 1 : 0}, ${ss.spellSlot === 1 ? 1 : 0})
        ON CONFLICT (champion_stat_id, spell_id)
        DO UPDATE SET
          count_win = champion_summoner_spells.count_win + EXCLUDED.count_win,
          count_game = champion_summoner_spells.count_game + 1,
          count_slot0 = champion_summoner_spells.count_slot0 + EXCLUDED.count_slot0,
          count_slot1 = champion_summoner_spells.count_slot1 + EXCLUDED.count_slot1
      `
    }

    // ── Timeline buckets ───────────────────────────────────────────────────
    for (const bucket of mp.buckets) {
      await prisma.$executeRaw`
        INSERT INTO champion_bucket
          (champion_stat_id, duration_bucket,
           count_win, count_game,
           sum_magic_damage_done, sum_magic_damage_done_to_champion, sum_magic_damage_taken,
           sum_physical_damage_done, sum_physical_damage_done_to_champion, sum_physical_damage_taken,
           sum_total_damage_done, sum_total_damage_done_to_champion, sum_total_damage_taken,
           sum_true_damage_done, sum_true_damage_done_to_champion, sum_true_damage_taken,
           sum_gold_per_second, sum_current_gold)
        VALUES
          (${coreStatId}, ${bucket.durationBucket},
           ${win}, 1,
           ${bucket.magicDamageDone}, ${bucket.magicDamageDoneToChampion}, ${bucket.magicDamageTaken},
           ${bucket.physicalDamageDone}, ${bucket.physicalDamageDoneToChampion}, ${bucket.physicalDamageTaken},
           ${bucket.totalDamageDone}, ${bucket.totalDamageDoneToChampion}, ${bucket.totalDamageTaken},
           ${bucket.trueDamageDone}, ${bucket.trueDamageDoneToChampion}, ${bucket.trueDamageTaken},
           ${bucket.goldPerSecond}, ${bucket.currentGold})
        ON CONFLICT (champion_stat_id, duration_bucket)
        DO UPDATE SET
          count_win = champion_bucket.count_win + EXCLUDED.count_win,
          count_game = champion_bucket.count_game + 1,
          sum_magic_damage_done = champion_bucket.sum_magic_damage_done + EXCLUDED.sum_magic_damage_done,
          sum_magic_damage_done_to_champion = champion_bucket.sum_magic_damage_done_to_champion + EXCLUDED.sum_magic_damage_done_to_champion,
          sum_magic_damage_taken = champion_bucket.sum_magic_damage_taken + EXCLUDED.sum_magic_damage_taken,
          sum_physical_damage_done = champion_bucket.sum_physical_damage_done + EXCLUDED.sum_physical_damage_done,
          sum_physical_damage_done_to_champion = champion_bucket.sum_physical_damage_done_to_champion + EXCLUDED.sum_physical_damage_done_to_champion,
          sum_physical_damage_taken = champion_bucket.sum_physical_damage_taken + EXCLUDED.sum_physical_damage_taken,
          sum_total_damage_done = champion_bucket.sum_total_damage_done + EXCLUDED.sum_total_damage_done,
          sum_total_damage_done_to_champion = champion_bucket.sum_total_damage_done_to_champion + EXCLUDED.sum_total_damage_done_to_champion,
          sum_total_damage_taken = champion_bucket.sum_total_damage_taken + EXCLUDED.sum_total_damage_taken,
          sum_true_damage_done = champion_bucket.sum_true_damage_done + EXCLUDED.sum_true_damage_done,
          sum_true_damage_done_to_champion = champion_bucket.sum_true_damage_done_to_champion + EXCLUDED.sum_true_damage_done_to_champion,
          sum_true_damage_taken = champion_bucket.sum_true_damage_taken + EXCLUDED.sum_true_damage_taken,
          sum_gold_per_second = champion_bucket.sum_gold_per_second + EXCLUDED.sum_gold_per_second,
          sum_current_gold = champion_bucket.sum_current_gold + EXCLUDED.sum_current_gold
      `
    }
  }
}

// ── Patch cleanup ────────────────────────────────────────────────────────────

export interface PatchCleanupConfig {
  maxMatchesPerPatch: number
  currentPatch: string
}

/**
 * Delete raw match data (matchs + cascade) for old patches that have reached maxMatches.
 * A patch is "old" if it's not the current patch.
 * We only delete if the patch has collected ≥ maxMatchesPerPatch total matches.
 * The aggregate tables are NOT deleted (they remain for stats).
 */
export async function deleteOldPatchRawData(
  config: PatchCleanupConfig,
  logger?: LoggerType
): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  const { maxMatchesPerPatch, currentPatch } = config

  // Find all patches (excluding current) that have reached the cap
  const patchCounts = await prisma.$queryRaw<Array<{ patch: string; cnt: bigint }>>`
    SELECT SUBSTRING(game_version FROM '^[0-9]+\.[0-9]+') AS patch,
           COUNT(*) AS cnt
    FROM matchs
    WHERE SUBSTRING(game_version FROM '^[0-9]+\.[0-9]+') != ${currentPatch}
    GROUP BY patch
    HAVING COUNT(*) >= ${maxMatchesPerPatch}
  `

  let deleted = 0
  for (const { patch, cnt } of patchCounts) {
    const count = Number(cnt)
    if (logger) void logger.step('Patch cleanup: deleting old patch raw data', { patch, matchCount: count })

    // Delete matches (cascade deletes teams, match_players, and all sub-tables)
    const result = await prisma.$executeRaw`
      DELETE FROM matchs
      WHERE SUBSTRING(game_version FROM '^[0-9]+\.[0-9]+') = ${patch}
      AND aggregated_at IS NOT NULL
    `
    deleted += Number(result)
    if (logger) void logger.step('Patch cleanup: deleted', { patch, deleted: Number(result) })
  }

  return deleted
}

/**
 * Load match-filter config and run patch cleanup for old patches that have reached maxMatches.
 */
export async function runPatchCleanupFromConfig(logger?: LoggerType): Promise<void> {
  if (!isDatabaseConfigured()) return

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) return

  const filters = filtersRes.unwrap()
  const currentVersion = filters.versions.find(v => !v.completed)
  if (!currentVersion) return

  const currentPatch = currentVersion.version

  // Look for versions that are completed with a maxMatches limit
  for (const v of filters.versions) {
    if (!v.completed || v.maxMatches == null || v.maxMatches <= 0) continue

    const patch = v.version
    if (patch === currentPatch) continue

    const deleted = await deleteOldPatchRawData(
      { maxMatchesPerPatch: v.maxMatches, currentPatch: patch },
      logger
    )
    if (deleted > 0 && logger) {
      void logger.step('Patch cleanup complete', { patch, deleted })
    }
  }
}
