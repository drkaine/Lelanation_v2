import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { IngestionJobData, ParsedParticipantDto, TeamStatsDto } from '../../../src/dto/match.dto.js';
// Aucun mock Redis/BullMQ : `ingestion.worker.ts` n'ouvre plus de connexion à
// l'import (l'instanciation du Worker vit dans ingestion.worker.bootstrap.ts, et
// les accès Redis/queues de processIngestionJob sont chargés paresseusement).
import { runAggregationTransaction } from '../../../src/workers/ingestion.worker.js';
import { sql } from '../../../src/db/client.js';

const ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'] as const;

function participant(over: {
  matchId: string;
  puuid: string;
  teamId: 100 | 200;
  championId: number;
  role: string;
  win: boolean;
  opponentChampionId: number;
  goldEarned?: number;
}): ParsedParticipantDto {
  return {
    matchId: over.matchId,
    puuid: over.puuid,
    patch: '15.13',
    gameDate: new Date('2026-07-01T12:00:00Z').toISOString(),
    gameEndTimestamp: 1_800_000,
    gameDurationSec: 1800,
    region: 'euw1',
    rankTier: 'GOLD',
    needsRankFetch: false,
    role: over.role,
    championId: over.championId,
    championTransform: 0,
    transformTimestampMs: 0,
    teamId: over.teamId,
    win: over.win,
    firstBloodKill: false,
    firstBloodAssist: false,
    firstTowerKill: false,
    firstTowerAssist: false,
    gameEndedInEarlySurrender: false,
    gameEndedInSurrender: false,
    teamEarlySurrendered: false,
    kills: 1,
    deaths: 1,
    assists: 1,
    goldEarned: over.goldEarned ?? 10_000,
    goldSpent: 9_000,
    opponentChampionId: over.opponentChampionId,
    opponentParticipantId: 0,
    opponentRole: over.role,
    spellOrder: '',
    spell1Casts: 0,
    spell2Casts: 0,
    spell3Casts: 0,
    spell4Casts: 0,
    spellLevelUpTimestampSumMs: 0,
    starterKey: '1055',
    coreKey: '3006_3031',
    materialKey: '',
    bootsKey: '3006',
    finalKey: '3006_3031_3072',
    items: [
      { itemId: 1055, phase: 'starter', timestampMs: 1000, win: over.win },
      { itemId: 3006, phase: 'core', timestampMs: 500_000, win: over.win },
      { itemId: 3031, phase: 'final', timestampMs: 900_000, win: over.win },
    ],
    runeList: '8005_9101',
    shardList: '5008_5008_5003',
    perks: [8005, 9101, 5008],
    spellD: 4,
    spellF: 7,
    spellDCasts: 0,
    spellFCasts: 0,
    rankTierValue: 'GOLD',
    rankDivision: 'II',
    lp: 50,
    bannedChampionId: 0,
    pickOrder: 1,
    u15: {
      goldEarned: 0,
      cs: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      visionScore: 0,
      physDmgToChampion: 0,
      magicDmgToChampion: 0,
      trueDmgToChampion: 0,
      shieldAndHeal: 0,
    },
  } as unknown as ParsedParticipantDto;
}

/** Match complet 10 joueurs : team 100 (champions 1-5) bat team 200 (champions 6-10). */
function buildMatch(matchId: string, championOffset = 0): IngestionJobData {
  const participants: ParsedParticipantDto[] = [];
  for (let i = 0; i < 5; i++) {
    const champ100 = 1 + i + championOffset;
    const champ200 = 6 + i + championOffset;
    participants.push(
      participant({
        matchId,
        puuid: `${matchId}-b${i}`,
        teamId: 100,
        championId: champ100,
        role: ROLES[i]!,
        win: true,
        opponentChampionId: champ200,
      }),
    );
    participants.push(
      participant({
        matchId,
        puuid: `${matchId}-r${i}`,
        teamId: 200,
        championId: champ200,
        role: ROLES[i]!,
        win: false,
        opponentChampionId: champ100,
      }),
    );
  }
  const teamStats: TeamStatsDto = {
    matchId,
    patch: '15.13',
    rankTier: 'GOLD',
    region: 'euw1',
    team100Win: true,
    objectives: [],
    surrendered: false,
    earlySurrendered: false,
    surrenderedTeam100: false,
    surrenderedTeam200: false,
    earlySurrenderedTeam100: false,
    earlySurrenderedTeam200: false,
    team100ChampionKills: 0,
    team200ChampionKills: 0,
    team100ElderDrakeFirst: false,
    team200ElderDrakeFirst: false,
  };
  return { participants, teamStats };
}

async function countRows(table: string): Promise<number> {
  const rows = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return Number((rows[0] as { c: number }).c);
}

describe('runAggregationTransaction (integration, isolated test DB)', () => {
  beforeEach(async () => {
    await sql.unsafe(`
      TRUNCATE champion_stats, champion_vs_stats, champion_duo_role_stats,
        champion_runes_stats, champion_runes_solo_stats, champion_shard_solo_stats,
        champion_item_solo_stats, champion_item_set_stats, champion_spell_stats,
        champion_summoner_spells, champion_summoner_spell_pair_stats,
        champion_bans_by_banner, champion_pick_order, champion_bucket,
        botlane_duo_vs_duo_stats, champion_tier_daily_snapshots,
        item_tier_daily_snapshots, match_outcome_stats, team_core_stat,
        champion_jungle_path,
        objective_outcome_histogram,
        match_aggregated, players, player_rank_history
      RESTART IDENTITY
    `);
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it('aggregates a full 10-player match into the expected core rows', async () => {
    await runAggregationTransaction(buildMatch('TEST_1'));

    // 10 distinct champions → 10 champion_stats rows, each count_game=1.
    expect(await countRows('champion_stats')).toBe(10);
    const winRows = await sql.unsafe(
      `SELECT count_game, count_win FROM champion_stats ORDER BY champion_id`,
    );
    for (const r of winRows as Array<{ count_game: number; count_win: number }>) {
      expect(Number(r.count_game)).toBe(1);
    }
    const totalWins = (winRows as Array<{ count_win: number }>).reduce(
      (s, r) => s + Number(r.count_win),
      0,
    );
    expect(totalWins).toBe(5); // team 100 (5 champions) won

    // Each participant has an opponent → 10 champion_vs_stats rows.
    expect(await countRows('champion_vs_stats')).toBe(10);

    // 5 players/team, each pairs with 4 allies → 10 * 4 = 40 duo rows (all distinct).
    expect(await countRows('champion_duo_role_stats')).toBe(40);
    const duoTotal = await sql.unsafe(
      `SELECT COALESCE(SUM(count_game),0)::int AS s FROM champion_duo_role_stats`,
    );
    expect(Number((duoTotal[0] as { s: number }).s)).toBe(40);

    // match_aggregated marker inserted.
    expect(await countRows('match_aggregated')).toBe(1);
  });

  it('batches the per-item / per-rune / per-spell tables correctly', async () => {
    await runAggregationTransaction(buildMatch('TEST_1'));

    // 10 champions × 3 distinct perks → 30 rune-solo rows; same for 3 shards.
    expect(await countRows('champion_runes_solo_stats')).toBe(30);
    expect(await countRows('champion_shard_solo_stats')).toBe(30);
    // 10 champions × distinct summoner spells {4,7} → 20 rows.
    expect(await countRows('champion_summoner_spells')).toBe(20);
    // 10 champions × 3 distinct items → 30 item-solo rows.
    expect(await countRows('champion_item_solo_stats')).toBe(30);
    // 10 champions × 3 phases (starter/core/final) → 30 item-set rows.
    expect(await countRows('champion_item_set_stats')).toBe(30);
    // 10 champions, one pick-order row each.
    expect(await countRows('champion_pick_order')).toBe(10);
    // one rune-combo row per champion.
    expect(await countRows('champion_runes_stats')).toBe(10);
    // one bucket row per champion (same duration bucket).
    expect(await countRows('champion_bucket')).toBe(10);

    // Accumulation sanity: rune-solo count_game per (champion,perk) = 1 for one match.
    const soloTotal = await sql.unsafe(
      `SELECT COALESCE(SUM(count_game),0)::int AS s FROM champion_runes_solo_stats`,
    );
    expect(Number((soloTotal[0] as { s: number }).s)).toBe(30);
  });

  it('accumulates counts across two matches with the same champions', async () => {
    await runAggregationTransaction(buildMatch('TEST_1'));
    await runAggregationTransaction(buildMatch('TEST_2'));

    // Same 10 champions/roles → still 10 rows, but count_game=2 each.
    expect(await countRows('champion_stats')).toBe(10);
    const rows = await sql.unsafe(`SELECT count_game FROM champion_stats`);
    for (const r of rows as Array<{ count_game: number }>) {
      expect(Number(r.count_game)).toBe(2);
    }

    // Duo rows: same 40 keys, each count_game=2.
    expect(await countRows('champion_duo_role_stats')).toBe(40);
    const duoTotal = await sql.unsafe(
      `SELECT COALESCE(SUM(count_game),0)::int AS s FROM champion_duo_role_stats`,
    );
    expect(Number((duoTotal[0] as { s: number }).s)).toBe(80);
  });

  it('merges champion_vs_stats order_items (games/wins) across repeated matches', async () => {
    async function vsOrderItemsGamesTotal(): Promise<number> {
      const rows = await sql.unsafe(
        `SELECT COALESCE((
           SELECT SUM((v.value ->> 'games')::bigint)
           FROM champion_vs_stats cs, jsonb_each(cs.order_items) AS v
         ), 0)::int AS games`,
      );
      return Number((rows[0] as { games: number }).games);
    }

    await runAggregationTransaction(buildMatch('TEST_1'));
    const afterOne = await vsOrderItemsGamesTotal();
    // count_game accumulates and order_items are additive → second identical match doubles.
    await runAggregationTransaction(buildMatch('TEST_2'));
    const afterTwo = await vsOrderItemsGamesTotal();

    // Rows stay stable (same 10 vs keys), count_game doubles.
    expect(await countRows('champion_vs_stats')).toBe(10);
    const cg = await sql.unsafe(`SELECT count_game FROM champion_vs_stats`);
    for (const r of cg as Array<{ count_game: number }>) {
      expect(Number(r.count_game)).toBe(2);
    }
    // order_items games total is strictly additive across the two matches.
    expect(afterTwo).toBe(afterOne * 2);
  });

  it('stores jsonb order columns as objects, not double-encoded strings', async () => {
    await runAggregationTransaction(buildMatch('TEST_1'));

    const vsTypes = await sql.unsafe(
      `SELECT DISTINCT jsonb_typeof(order_items) AS t FROM champion_vs_stats WHERE order_items IS NOT NULL`,
    );
    for (const r of vsTypes as Array<{ t: string }>) {
      expect(r.t).toBe('object');
    }

    const orderTypes = await sql.unsafe(
      `SELECT DISTINCT jsonb_typeof("order") AS t FROM item_tier_daily_snapshots WHERE "order" IS NOT NULL`,
    );
    for (const r of orderTypes as Array<{ t: string }>) {
      expect(r.t).toBe('object');
    }
  });

  it('sums gold metrics for a repeated champion+role across matches', async () => {
    // TEST_1 blue TOP champion 1 with 12000 gold, TEST_2 same champion with 8000.
    const m1 = buildMatch('TEST_1');
    m1.participants.find((p) => p.championId === 1)!.goldEarned = 12_000;
    const m2 = buildMatch('TEST_2');
    m2.participants.find((p) => p.championId === 1)!.goldEarned = 8_000;
    await runAggregationTransaction(m1);
    await runAggregationTransaction(m2);

    const rows = await sql.unsafe(
      `SELECT sum_gold_earned FROM champion_stats WHERE champion_id = 1`,
    );
    expect(rows).toHaveLength(1);
    expect(Number((rows[0] as { sum_gold_earned: number }).sum_gold_earned)).toBe(20_000);
  });
});
