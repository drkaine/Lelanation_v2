import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../../src/db/query.js', () => ({
  queryRawUnsafe: (text: string) => queryMock(text),
  isDatabaseConfigured: () => true,
}));

const { getTeamMiscStats, mergeDuoRows, teamMiscPatchSql } = await import(
  '../../../../src/services/StatsTeamMiscService.js'
);
const { runWithStatsRegion } = await import('../../../../src/stats/statsRegion.js');

describe('teamMiscPatchSql', () => {
  it('patch exact ou sous-version, échappé ; aucun = pas de filtre', () => {
    expect(teamMiscPatchSql('m.patch', [])).toBeNull();
    expect(teamMiscPatchSql('m.patch', ['16.1'])).toBe("(m.patch = '16.1' OR m.patch LIKE '16.1.%')");
    expect(teamMiscPatchSql('m.patch', ["16.1'x"])).toContain("16.1''x");
    expect(teamMiscPatchSql('d.patch', ['16.1', '16.2'])).toBe(
      "((d.patch = '16.1' OR d.patch LIKE '16.1.%') OR (d.patch = '16.2' OR d.patch LIKE '16.2.%'))"
    );
  });
});

describe('mergeDuoRows', () => {
  it('paire de rôles dans l’ordre TOP→UTILITY, lignes fusionnées', () => {
    expect(
      mergeDuoRows([
        { role_a: 'UTILITY', role_b: 'BOTTOM', tier: 'GOLD', team_id: 100, games: 3n, wins: 2n },
        { role_a: 'BOTTOM', role_b: 'UTILITY', tier: 'GOLD', team_id: 100, games: 1n, wins: 0n },
        { role_a: 'BOTTOM', role_b: 'UTILITY', tier: 'GOLD', team_id: 200, games: 5n, wins: 1n },
        { role_a: 'JUNGLE', role_b: 'MIDDLE', tier: 'IRON', team_id: 200, games: 2, wins: 1 },
      ])
    ).toEqual([
      { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', side: 'BLUE', games: 4, wins: 2 },
      { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', side: 'RED', games: 5, wins: 1 },
      { roleA: 'JUNGLE', roleB: 'MIDDLE', tier: 'IRON', side: 'RED', games: 2, wins: 1 },
    ]);
  });

  it('ignore rôles, tier ou côté absents', () => {
    expect(mergeDuoRows([{ role_a: null, role_b: 'TOP', tier: 'GOLD', team_id: 100, games: 1, wins: 1 }])).toEqual([]);
    expect(mergeDuoRows([{ role_a: 'TOP', role_b: 'MIDDLE', tier: null, team_id: 100, games: 1, wins: 1 }])).toEqual([]);
    expect(mergeDuoRows([{ role_a: 'TOP', role_b: 'MIDDLE', tier: 'GOLD', team_id: null, games: 1, wins: 1 }])).toEqual([]);
  });
});

describe('getTeamMiscStats', () => {
  beforeEach(() => queryMock.mockReset());

  it('AFK par rôle et rang du joueur à la date du match, duos par paire de rôles et rang le plus haut', async () => {
    queryMock
      .mockResolvedValueOnce([
        { role: 'TOP', tier: 'GOLD', team_id: 100, games: 10n, afk: 1n },
        { role: 'TOP', tier: 'GOLD', team_id: 200, games: 8n, afk: 2n },
        { role: 'TOP', tier: 'GOLD', team_id: 300, games: 1n, afk: 1n },
      ])
      .mockResolvedValueOnce([{ role_a: 'TOP', role_b: 'JUNGLE', tier: 'GOLD', team_id: 200, games: 5n, wins: 3n }]);
    const data = await getTeamMiscStats('16.1');
    expect(data).toEqual({
      afk: [
        { role: 'TOP', tier: 'GOLD', side: 'BLUE', games: 10, afk: 1 },
        { role: 'TOP', tier: 'GOLD', side: 'RED', games: 8, afk: 2 },
      ],
      duos: [{ roleA: 'TOP', roleB: 'JUNGLE', tier: 'GOLD', side: 'RED', games: 5, wins: 3 }],
    });
    const [afkSql] = queryMock.mock.calls[0];
    expect(afkSql).toContain('was_afk');
    expect(afkSql).toContain('player_rank_history');
    expect(afkSql).toContain('h.date <= m.game_date');
    expect(afkSql).toContain("m.patch = '16.1'");
    expect(afkSql).toContain('p.team_id');
    const [duoSql] = queryMock.mock.calls[1];
    expect(duoSql).toContain('FROM player_duo_games d');
    expect(duoSql).toContain('GREATEST(d.tier_a, d.tier_b)');
    expect(duoSql).toContain("d.patch = '16.1'");
    expect(duoSql).toContain('pa.puuid = d.puuid_a');
    expect(duoSql).toContain('pa.team_id');
  });

  it('filtre région sur les deux requêtes, cache par région', async () => {
    queryMock.mockResolvedValue([]);
    await runWithStatsRegion(['KR'], () => getTeamMiscStats('16.9'));
    expect(queryMock.mock.calls[0][0]).toContain("m.region = 'KR'");
    expect(queryMock.mock.calls[1][0]).toContain("d.region = 'KR'");
    const calls = queryMock.mock.calls.length;
    await runWithStatsRegion(['KR'], () => getTeamMiscStats('16.9'));
    expect(queryMock).toHaveBeenCalledTimes(calls);
    await runWithStatsRegion(['EUW1'], () => getTeamMiscStats('16.9'));
    expect(queryMock.mock.calls.length).toBeGreaterThan(calls);
  });

  it('deux appels simultanés : une seule requête (calcul ~10 s)', async () => {
    queryMock.mockResolvedValue([]);
    await Promise.all([getTeamMiscStats('15.1'), getTeamMiscStats('15.1')]);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});
