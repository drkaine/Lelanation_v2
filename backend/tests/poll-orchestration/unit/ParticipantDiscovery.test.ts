import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));

import { sql } from '../../../src/db/client.js';
import { ParticipantDiscovery } from '../../../src/poll-orchestration/ParticipantDiscovery.js';

describe('ParticipantDiscovery', () => {
  beforeEach(() => {
    vi.mocked(sql).mockReset();
  });

  test('extractFromMatch returns 10 participants with euw1 region', () => {
    const discovery = new ParticipantDiscovery();
    const puuids = Array.from({ length: 10 }, (_, i) => `p-${i}`);
    const match = {
      metadata: { matchId: 'EUW1_123' },
      info: {
        participants: puuids.map((puuid, index) => ({
          puuid,
          riotIdGameName: `Name${index}`,
          riotIdTagline: 'TAG',
        })),
      },
    };
    const result = discovery.extractFromMatch('EUW1_123', match);
    expect(result).toHaveLength(10);
    expect(result.every((row) => row.region === 'euw1')).toBe(true);
    expect(result[0]?.gameName).toBe('Name0');
    expect(result[0]?.tagName).toBe('TAG');
  });

  test('upsertParticipants empty returns 0 without DB call', async () => {
    const discovery = new ParticipantDiscovery();
    expect(await discovery.upsertParticipants([])).toBe(0);
    expect(sql).not.toHaveBeenCalled();
  });

  test('upsertParticipants returns inserted count', async () => {
    vi.mocked(sql).mockResolvedValueOnce([{ puuid: 'a' }, { puuid: 'b' }, { puuid: 'c' }]);
    const discovery = new ParticipantDiscovery();
    const count = await discovery.upsertParticipants([
      { puuid: 'a', region: 'euw1' },
      { puuid: 'b', region: 'euw1' },
      { puuid: 'c', region: 'euw1' },
    ]);
    expect(count).toBe(3);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
