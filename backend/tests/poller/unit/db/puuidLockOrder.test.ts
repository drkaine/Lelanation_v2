import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));

import { sql } from '../../../../src/db/client.js';
import { upsertPlayersIfMissing } from '../../../../src/db/queries/players.js';
import { sortByPuuid } from '../../../../src/db/puuidLockOrder.js';
import { ParticipantDiscovery } from '../../../../src/poll-orchestration/ParticipantDiscovery.js';

describe('puuid lock order', () => {
  beforeEach(() => vi.mocked(sql).mockReset());

  test('sort_by_puuid_uses_code_point_order', () => {
    const rows = [{ puuid: 'b' }, { puuid: '_x' }, { puuid: 'B' }, { puuid: '-y' }];
    expect(sortByPuuid(rows).map((r) => r.puuid)).toEqual(['-y', 'B', '_x', 'b']);
  });

  test('participant_discovery_inserts_players_in_puuid_order', async () => {
    vi.mocked(sql).mockResolvedValueOnce([]);
    await new ParticipantDiscovery().upsertParticipants([
      { puuid: 'c', region: 'euw1' },
      { puuid: 'a', region: 'na1' },
      { puuid: 'b', region: 'euw1' },
    ]);
    const values = vi.mocked(sql).mock.calls[0]?.slice(1) ?? [];
    expect(values).toContainEqual(['a', 'b', 'c']);
    expect(values).toContainEqual(['NA1', 'EUW1', 'EUW1']);
  });

  test('upsert_players_if_missing_inserts_in_puuid_order', async () => {
    vi.mocked(sql).mockResolvedValueOnce([]);
    await upsertPlayersIfMissing(['c', 'a', 'b', 'a'], 'euw1');
    expect(vi.mocked(sql).mock.calls[0]?.slice(1)).toContainEqual(['a', 'b', 'c']);
  });
});
