import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));

import { sql } from '../../../../src/db/client.js';
import { insertRankHistory } from '../../../../src/db/queries/ranks.js';

describe('insertRankHistory', () => {
  beforeEach(() => vi.mocked(sql).mockReset());

  test('updates the daily row with the latest LP, without downgrading a ranked row to UNRANKED', async () => {
    vi.mocked(sql).mockResolvedValueOnce([] as never);
    await insertRankHistory({
      puuid: 'p',
      region: 'euw1',
      rankTier: 'GOLD',
      rankDivision: 'II',
      rankLp: 55,
      rankedAt: new Date('2026-11-10T20:00:00Z'),
    });
    const strings = (vi.mocked(sql).mock.calls[0]?.[0] ?? []) as unknown as string[];
    const text = strings.join('?').replace(/\s+/g, ' ');
    expect(text).toContain('ON CONFLICT (puuid, date, region) DO UPDATE');
    expect(text).toContain('rank_lp = EXCLUDED.rank_lp');
    expect(text).toContain("EXCLUDED.rank_tier <> 'UNRANKED'");
    expect(text).not.toContain('DO NOTHING');
  });
});
