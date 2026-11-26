import { describe, expect, it } from 'vitest';
import { matchVersionedAggFrom } from '../../../../src/stats/statsPatchQuery.js';
import { runWithStatsRegion } from '../../../../src/stats/statsRegion.js';

const inCtx = <T>(otp: 'all' | 'only' | 'exclude', fn: () => Promise<T>) =>
  new Promise<T>((resolve, reject) => runWithStatsRegion(null, () => void fn().then(resolve, reject), otp));

describe('lecture stats : filtre ?otp= dans les sous-requêtes d’agrégats', () => {
  it('all : aucune condition otp (total = somme des lignes)', async () => {
    const sql = await inCtx('all', () => matchVersionedAggFrom('agg_champion_core_stats', '15.13', 'x'));
    expect(sql).not.toMatch(/\botp\s*=/);
  });
  it('only : cs.otp = true sur champion_stats', async () => {
    const sql = await inCtx('only', () => matchVersionedAggFrom('agg_champion_core_stats', '15.13', 'x'));
    expect(sql).toContain('cs.otp = true');
  });
  it('exclude : bans, match outcome, team core, botlane, bucket filtrés', async () => {
    for (const [table, alias] of [
      ['agg_champion_bans_by_banner', 'bb'], ['agg_match_outcome_stats', 'mo'], ['agg_team_core_stats', 'tc'],
      ['agg_botlane_duo_vs_duo_stats', 'bd'], ['agg_champion_bucket', 't'],
    ] as const) {
      const sql = await inCtx('exclude', () => matchVersionedAggFrom(table, null, 'x'));
      expect(sql, table).toContain(`${alias}.otp = false`);
    }
  });
  it('table sans colonne otp : pas de condition (pas d’erreur SQL)', async () => {
    const sql = await inCtx('only', () => matchVersionedAggFrom('agg_some_unknown_table', null, 'x'));
    expect(sql).not.toMatch(/\botp\s*=/);
  });
});
