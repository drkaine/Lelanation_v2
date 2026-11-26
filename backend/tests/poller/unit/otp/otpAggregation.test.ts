import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMatch } from './matchFixture.js';

interface Captured {
  text: string;
  values: unknown[];
}
const captured: Captured[] = [];

function fakeTx(strings: TemplateStringsArray | string, ...values: unknown[]) {
  const text = typeof strings === 'string' ? strings : strings.join('?');
  captured.push({ text, values: values.flat(3) });
  return Promise.resolve(Object.assign([], { count: 0 }));
}
fakeTx.unsafe = (text: string, values: unknown[] = []) => {
  captured.push({ text, values });
  return Promise.resolve(Object.assign([], { count: 0 }));
};
fakeTx.json = (v: unknown) => v;

vi.mock('../../../../src/db/client.js', () => ({
  sql: Object.assign(fakeTx, { begin: (fn: (tx: typeof fakeTx) => unknown) => fn(fakeTx) }),
}));
vi.mock('../../../../src/config/index.js', () => ({ config: { PLAYER_KEY_VERSION: 1 } }));
vi.mock('../../../../src/redis/client.js', () => ({ redis: {} }));
vi.mock('../../../../src/services/normalizedMatchPersistence.js', () => ({
  insertMatchAggregated: vi.fn(),
  isMatchAlreadyAggregated: vi.fn(async () => false),
}));
const otpPuuids = vi.fn(async (_p: string[]) => new Set<string>());
vi.mock('../../../../src/services/OtpFlagService.js', async (orig) => ({
  ...(await orig<object>()),
  loadOtpPuuids: (p: string[]) => otpPuuids(p),
}));

const AGGREGATE_TABLES = [
  'botlane_duo_vs_duo_stats', 'champion_bans_by_banner', 'champion_bucket', 'champion_duo_role_stats',
  'champion_item_set_stats', 'champion_item_solo_stats', 'champion_jungle_path', 'champion_pick_order',
  'champion_runes_solo_stats', 'champion_runes_stats', 'champion_shard_solo_stats', 'champion_spell_stats',
  'champion_stats', 'champion_summoner_spell_pair_stats', 'champion_summoner_spells',
  'champion_tier_daily_snapshots', 'champion_vs_stats', 'item_tier_daily_snapshots', 'match_outcome_stats',
  'objective_outcome_histogram', 'team_core_stat',
];

const aggregateInserts = () =>
  captured.flatMap((c) => {
    const table = /INSERT INTO\s+(\w+)/.exec(c.text)?.[1];
    return table && AGGREGATE_TABLES.includes(table) ? [{ table, ...c }] : [];
  });

describe('agrégation : colonne otp dans chaque upsert d’agrégat', () => {
  beforeEach(() => {
    captured.length = 0;
    otpPuuids.mockClear();
  });

  it('chaque INSERT d’agrégat a otp dans sa clé de conflit', async () => {
    const { runAggregationTransaction } = await import('../../../../src/workers/ingestion.worker.js');
    await runAggregationTransaction(buildMatch('EUW1_1'));
    const inserts = aggregateInserts();
    expect(inserts.length).toBeGreaterThan(10);
    const missing = inserts.filter((i) => !/ON CONFLICT\s*\([^)]*\botp\b[^)]*\)/.test(i.text)).map((i) => i.table);
    expect(missing).toEqual([]);
  });

  it('flags chargés depuis otp_players pour les joueurs du match ; un OTP → valeurs true', async () => {
    otpPuuids.mockResolvedValueOnce(new Set(['EUW1_2-b0']));
    const { runAggregationTransaction } = await import('../../../../src/workers/ingestion.worker.js');
    await runAggregationTransaction(buildMatch('EUW1_2'));
    expect(otpPuuids).toHaveBeenCalledWith(expect.arrayContaining(['EUW1_2-b0', 'EUW1_2-r4']));
    const byTable = new Map<string, unknown[]>();
    for (const i of aggregateInserts()) byTable.set(i.table, [...(byTable.get(i.table) ?? []), ...i.values]);
    for (const table of ['champion_stats', 'team_core_stat', 'match_outcome_stats', 'champion_bans_by_banner']) {
      expect(byTable.get(table), table).toContain(true);
    }
  });

  it('aucun OTP : aucune valeur otp à true', async () => {
    const { runAggregationTransaction } = await import('../../../../src/workers/ingestion.worker.js');
    await runAggregationTransaction(buildMatch('EUW1_3'));
    const champ = aggregateInserts().find((i) => i.table === 'champion_stats');
    expect(champ?.values).not.toContain(true);
  });
});
