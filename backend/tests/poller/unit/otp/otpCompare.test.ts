import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../../src/db/query.js', () => ({
  queryRawUnsafe: (text: string) => queryMock(text),
  isDatabaseConfigured: () => true,
}));

const { buildOtpCompare, buildOtpPopulation, getOtpCompare, resetOtpCompareCache, MIN_OTP_WINRATE_GAMES } = await import(
  '../../../../src/services/StatsOtpCompareService.js'
);

const group = (g: 'otp' | 'others', games: number, extra: Partial<Record<string, number>> = {}) => ({
  grp: g,
  games,
  wins: games / 2,
  kills: games * 5,
  deaths: games * 5,
  assists: games * 5,
  afk: 0,
  champions: 10,
  ...extra,
});
const champ = (g: 'otp' | 'others', champion: number, picks: number, wins: number) => ({ grp: g, champion, picks, wins });

describe('buildOtpCompare', () => {
  it('résumé par groupe : winrate, KDA, kills moyens, AFK, champions distincts', () => {
    const r = buildOtpCompare([group('otp', 100, { wins: 60, deaths: 250, afk: 1 }), group('others', 1000)], []);
    expect(r.groups[0]).toEqual({
      group: 'otp',
      games: 100,
      winRate: 60,
      kda: 4,
      avgKills: 5,
      afkRate: 1,
      champions: 10,
    });
    expect(r.groups.map((g) => g.group)).toEqual(['otp', 'others']);
  });

  it('écarts : part de pick et winrate OTP vs autres, triés par écart', () => {
    const r = buildOtpCompare(
      [group('otp', 100), group('others', 1000)],
      [
        champ('otp', 1, 30, 18),
        champ('others', 1, 30, 15),
        champ('otp', 2, 10, 5),
        champ('others', 2, 100, 50),
      ],
    );
    expect(r.spreads.pickRate[0]).toMatchObject({ championId: 1, spread: 27, high: 'otp', low: 'others' });
    expect(r.spreads.winRate[0]).toMatchObject({ championId: 1, spread: 10, high: 'otp' });
    expect(r.top.find((t) => t.group === 'otp')?.picked[0]).toEqual({ championId: 1, rate: 30, games: 30 });
  });

  it('winrate ignoré sous le minimum de parties', () => {
    const few = MIN_OTP_WINRATE_GAMES - 1;
    const r = buildOtpCompare([group('otp', 100), group('others', 100)], [champ('otp', 1, few, few), champ('others', 1, 50, 10)]);
    expect(r.spreads.winRate).toEqual([]);
  });

  it('pas de nom de joueur dans la sortie', () => {
    const r = buildOtpCompare([group('otp', 100)], []);
    expect(JSON.stringify(r)).not.toMatch(/puuid|name/i);
  });
});

describe('getOtpCompare : SQL sur otp_players, sans exposer les joueurs', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue([]);
    resetOtpCompareCache();
  });
  it('groupe par appartenance à otp_players et filtre le patch', async () => {
    await getOtpCompare('16.9');
    const texts = queryMock.mock.calls.map((c) => String(c[0])).filter((t) => t.includes('participants'));
    expect(texts.length).toBe(2);
    for (const t of texts) {
      expect(t).toContain('otp_players');
      expect(t).toContain('16.9');
      expect(t).not.toMatch(/SELECT[^;]*\bpuuid\b\s*(,|AS|FROM)/i);
    }
  });
  it('cache par patch', async () => {
    await getOtpCompare('16.9');
    await getOtpCompare('16.9');
    expect(queryMock).toHaveBeenCalledTimes(3);
  });
  it('population : compte par région et tier courant, agrégé (aucun puuid renvoyé)', async () => {
    await getOtpCompare('16.9');
    const pop = queryMock.mock.calls.map((c) => String(c[0])).find((t) => !t.includes('participants'));
    expect(pop).toBeDefined();
    expect(pop).toContain('otp_players');
    expect(pop).toContain('player_rank_history');
    expect(pop).toMatch(/GROUP BY/i);
    const tail = String(pop).slice(String(pop).lastIndexOf('SELECT'));
    const outer = tail.slice(0, tail.indexOf('FROM'));
    expect(outer).not.toMatch(/\bpuuid\b/);
  });
});

describe('buildOtpPopulation', () => {
  it('total, par région (tri décroissant) et par tier (ordre du ladder), joueurs sans rang en UNRANKED', () => {
    const pop = buildOtpPopulation([
      { region: 'EUW1', tier: 'MASTER', players: 30 },
      { region: 'EUW1', tier: 'GOLD', players: 5 },
      { region: 'KR', tier: 'MASTER', players: 20 },
      { region: 'KR', tier: null, players: 2 },
    ]);
    expect(pop.total).toBe(57);
    expect(pop.byRegion).toEqual([
      { region: 'EUW1', players: 35, pct: 61.4 },
      { region: 'KR', players: 22, pct: 38.6 },
    ]);
    expect(pop.byTier.map((t) => t.tier)).toEqual(['GOLD', 'MASTER', 'UNRANKED']);
    expect(pop.byTier.find((t) => t.tier === 'MASTER')).toEqual({ tier: 'MASTER', players: 50, pct: 87.7 });
    expect(pop.cells).toContainEqual({ region: 'KR', tier: 'UNRANKED', players: 2 });
  });
  it('vide → total 0', () => {
    expect(buildOtpPopulation([])).toEqual({ total: 0, byRegion: [], byTier: [], cells: [] });
  });
});
