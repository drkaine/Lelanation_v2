import { describe, expect, it } from 'vitest';
import type { ParsedParticipantDto } from '../../../src/dto/match.dto.js';
import { buildDuoRoleAggregationRows } from '../../../src/workers/duoRoleAggregation.js';

function mk(over: Partial<ParsedParticipantDto> & {
  matchId: string;
  puuid: string;
  teamId: 100 | 200;
  championId: number;
  role: string;
}): ParsedParticipantDto {
  return {
    patch: '15.13',
    rankTier: 'GOLD',
    region: 'euw1',
    win: false,
    championTransform: 0,
    goldEarned: 0,
    goldSpent: 0,
    sum_max_level_lead_lane_opponent: 0,
    sum_max_kill_deficit: 0,
    sum_more_enemy_jungle_than_opponent: 0,
    sum_max_cs_advantage_on_lane_opponent: 0,
    sum_vision_score_advantage_lane_opponent: 0,
    sum_laning_phase_gold_exp_advantage: 0,
    sum_early_laning_phase_gold_exp_advantage: 0,
    ...over,
  } as unknown as ParsedParticipantDto;
}

describe('buildDuoRoleAggregationRows', () => {
  it('returns no rows for a participant without allies', () => {
    const rows = buildDuoRoleAggregationRows([
      mk({ matchId: 'M1', puuid: 'a', teamId: 100, championId: 1, role: 'TOP' }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it('creates one row per ordered (champion, ally) pair', () => {
    const rows = buildDuoRoleAggregationRows([
      mk({ matchId: 'M1', puuid: 'a', teamId: 100, championId: 1, role: 'TOP' }),
      mk({ matchId: 'M1', puuid: 'b', teamId: 100, championId: 2, role: 'MID' }),
    ]);
    // a->b and b->a : two ordered pairs, distinct conflict keys
    expect(rows).toHaveLength(2);
    const total = rows.reduce((s, r) => s + r.countGame, 0);
    expect(total).toBe(2);
  });

  it('carries the source participant metrics, not the ally metrics', () => {
    const rows = buildDuoRoleAggregationRows([
      mk({
        matchId: 'M1', puuid: 'a', teamId: 100, championId: 1, role: 'TOP',
        win: true, goldEarned: 5000, sum_max_kill_deficit: 3,
      }),
      mk({
        matchId: 'M1', puuid: 'b', teamId: 100, championId: 2, role: 'MID',
        win: true, goldEarned: 9999, sum_max_kill_deficit: 7,
      }),
    ]);
    const aRow = rows.find((r) => r.championId === 1 && r.allyChampionId === 2)!;
    expect(aRow.countWin).toBe(1);
    expect(aRow.sumGoldEarned).toBe(5000);
    expect(aRow.sumMaxKillDeficit).toBe(3);
  });

  it('does not pair participants across teams or matches', () => {
    const rows = buildDuoRoleAggregationRows([
      mk({ matchId: 'M1', puuid: 'a', teamId: 100, championId: 1, role: 'TOP' }),
      mk({ matchId: 'M1', puuid: 'b', teamId: 200, championId: 2, role: 'TOP' }),
      mk({ matchId: 'M2', puuid: 'c', teamId: 100, championId: 3, role: 'TOP' }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it('merges duplicate conflict keys and sums counts + metrics', () => {
    // Two TOP champion-1 players on the same team, plus a MID ally.
    // Both champ-1 players pair with the MID ally under the SAME conflict key.
    const rows = buildDuoRoleAggregationRows([
      mk({ matchId: 'M1', puuid: 'a', teamId: 100, championId: 1, role: 'TOP', win: true, goldEarned: 100 }),
      mk({ matchId: 'M1', puuid: 'c', teamId: 100, championId: 1, role: 'TOP', win: false, goldEarned: 200 }),
      mk({ matchId: 'M1', puuid: 'b', teamId: 100, championId: 2, role: 'MID', win: true, goldEarned: 500 }),
    ]);
    const merged = rows.find(
      (r) => r.championId === 1 && r.role === 'TOP' && r.allyChampionId === 2 && r.allyRole === 'MID',
    )!;
    expect(merged.countGame).toBe(2);
    expect(merged.countWin).toBe(1); // a won, c lost
    expect(merged.sumGoldEarned).toBe(300); // 100 + 200

    // Total ordered pairs on a 3-player team = 3 * 2 = 6
    const total = rows.reduce((s, r) => s + r.countGame, 0);
    expect(total).toBe(6);
  });
});
