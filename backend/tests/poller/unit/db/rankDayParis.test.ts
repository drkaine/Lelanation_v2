import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));
vi.mock('../../../../src/observability/poller-metrics/timedDbOp.js', () => ({
  timedDbOp: (_name: string, fn: () => unknown) => fn(),
}));

import { sql } from '../../../../src/db/client.js';
import { getMissingRanksToday, hasRankToday, insertRankHistory } from '../../../../src/db/queries/ranks.js';
import { RankFilter } from '../../../../src/poll-orchestration/RankFilter.js';

/** 00:30 local le 27/11 : jour du balayage 27/11, date UTC encore 26/11. */
const LOCAL_0030 = new Date(2026, 10, 27, 0, 30, 0);

function call(i = 0) {
  const c = vi.mocked(sql).mock.calls[i] ?? [];
  const text = ((c[0] ?? []) as unknown as string[]).join('?');
  return { text, values: c.slice(1) };
}

describe('jour de rang = jour du balayage (local, 00:01), pas la date UTC', () => {
  beforeEach(() => {
    vi.mocked(sql).mockReset();
    vi.mocked(sql).mockResolvedValue([] as never);
    vi.useFakeTimers();
    vi.setSystemTime(LOCAL_0030);
  });

  test('insertRankHistory écrit le jour du balayage', async () => {
    await insertRankHistory({ puuid: 'p', region: 'euw1', rankTier: 'GOLD', rankDivision: 'II', rankLp: 1, rankedAt: LOCAL_0030 });
    expect(call().values).toContain('2026-11-27');
  });

  test('lectures : jour du balayage en paramètre, plus de CURRENT_DATE', async () => {
    await hasRankToday('p', 'euw1');
    await getMissingRanksToday(['p'], 'euw1');
    await new RankFilter().isKnownToday('p', 'euw1');
    await new RankFilter().prefetchBatch([{ puuid: 'p', region: 'euw1' }]);
    for (let i = 0; i < 4; i++) {
      expect(call(i).text).not.toContain('CURRENT_DATE');
      expect(call(i).values).toContain('2026-11-27');
    }
    vi.useRealTimers();
  });
});
