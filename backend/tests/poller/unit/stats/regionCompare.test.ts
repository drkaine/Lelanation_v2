import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../../src/db/query.js', () => ({
  queryRawUnsafe: (text: string) => queryMock(text),
  isDatabaseConfigured: () => true,
}));

const { buildRegionCompare, getRegionCompare, resetRegionCompareCache } = await import(
  '../../../../src/services/StatsRegionCompareService.js'
);

const summary = (region: string, matches: number, extra: Partial<Record<string, number>> = {}) => ({
  region,
  matches,
  surrender: 0,
  early_surrender: 0,
  duration_sum: matches * 1800,
  participants: matches * 10,
  afk: 0,
  kills: matches * 30,
  ...extra,
});
const champ = (region: string, champion: number, picks: number, wins: number) => ({ region, champion, picks, wins });
const ban = (region: string, champion: number, bans: number) => ({ region, champion, bans });

describe('buildRegionCompare', () => {
  it('résumé par région : taux de surrender, early, AFK, durée et kills moyens', () => {
    const r = buildRegionCompare(
      [summary('EUW1', 200, { surrender: 50, early_surrender: 10, afk: 20 })],
      [],
      [],
    );
    expect(r.regions).toEqual([
      {
        region: 'EUW1',
        matches: 200,
        surrenderRate: 25,
        earlySurrenderRate: 5,
        afkRate: 1,
        avgDurationMin: 30,
        avgKills: 30,
      },
    ]);
  });

  it('régions sous le seuil de matchs exclues', () => {
    const r = buildRegionCompare([summary('EUW1', 200), summary('KR', 10)], [], []);
    expect(r.regions.map((x) => x.region)).toEqual(['EUW1']);
  });

  it('top par région : plus pickés, plus bannis, meilleurs winrates (échantillon minimal)', () => {
    const r = buildRegionCompare(
      [summary('EUW1', 200)],
      [champ('EUW1', 1, 100, 40), champ('EUW1', 2, 50, 35), champ('EUW1', 3, 5, 5)],
      [ban('EUW1', 9, 80), ban('EUW1', 1, 20)],
    );
    const euw = r.topByRegion[0]!;
    expect(euw.region).toBe('EUW1');
    expect(euw.picked.map((c) => [c.championId, c.rate])).toEqual([[1, 50], [2, 25], [3, 2.5]]);
    expect(euw.banned.map((c) => [c.championId, c.rate])).toEqual([[9, 40], [1, 10]]);
    // champion 3 : 5 parties, sous le seuil de winrate
    expect(euw.winrate.map((c) => [c.championId, c.rate])).toEqual([[2, 70], [1, 40]]);
  });

  it('plus grands écarts entre régions, triés par écart décroissant', () => {
    const r = buildRegionCompare(
      [summary('EUW1', 200), summary('KR', 200)],
      [
        champ('EUW1', 1, 100, 50), champ('KR', 1, 20, 10),
        champ('EUW1', 2, 40, 20), champ('KR', 2, 40, 30),
      ],
      [ban('EUW1', 1, 10), ban('KR', 1, 90)],
    );
    expect(r.spreads.pickRate[0]).toEqual({
      championId: 1,
      byRegion: { EUW1: 50, KR: 10 },
      spread: 40,
      high: 'EUW1',
      low: 'KR',
    });
    expect(r.spreads.banRate[0]?.spread).toBe(40);
    expect(r.spreads.banRate[0]?.high).toBe('KR');
    // champion 2 : 50 % EUW, 75 % KR ; champion 1 : 50 % / 50 %
    expect(r.spreads.winRate.map((s) => [s.championId, s.spread])).toEqual([[2, 25], [1, 0]]);
  });

  it('une seule région : aucun écart', () => {
    const r = buildRegionCompare([summary('EUW1', 200)], [champ('EUW1', 1, 100, 50)], []);
    expect(r.spreads).toEqual({ pickRate: [], banRate: [], winRate: [] });
  });
});

describe('getRegionCompare', () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetRegionCompareCache();
  });

  it('3 requêtes filtrées par patch, toutes régions, mises en cache', async () => {
    queryMock.mockResolvedValue([]);
    await getRegionCompare('16.23');
    await getRegionCompare('16.23');
    expect(queryMock).toHaveBeenCalledTimes(3);
    for (const [sql] of queryMock.mock.calls) {
      expect(sql).toContain("m.patch = '16.23'");
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('m.region');
    }
    expect(queryMock.mock.calls.some(([sql]) => String(sql).includes('id_champion_ban'))).toBe(true);
  });
});
