import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../../src/db/query.js', () => ({
  queryRawUnsafe: (text: string) => queryMock(text),
  isDatabaseConfigured: () => true,
}));

const { getTeamMiscStats, mergeDuoBans, mergeDuoPicks, mergeDuoRows, teamMiscPatchSql } = await import(
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

const zero = {
  surr_for: 0,
  surr_against: 0,
  afk: 0,
  own_dragons: 0,
  enemy_dragons: 0,
  own_barons: 0,
  enemy_barons: 0,
  own_towers: 0,
  enemy_towers: 0,
  own_grubs: 0,
  enemy_grubs: 0,
  own_heralds: 0,
  enemy_heralds: 0,
};
const noObj = {
  dragons: { own: 0, enemy: 0 },
  barons: { own: 0, enemy: 0 },
  towers: { own: 0, enemy: 0 },
  grubs: { own: 0, enemy: 0 },
  heralds: { own: 0, enemy: 0 },
};
const duoTail = { surrenderFor: 0, surrenderAgainst: 0, afk: 0, objectives: noObj };

describe('mergeDuoRows', () => {
  it('paire de rôles dans l’ordre TOP→UTILITY, lignes fusionnées', () => {
    expect(
      mergeDuoRows([
        { ...zero, role_a: 'UTILITY', role_b: 'BOTTOM', tier: 'GOLD', team_id: 100, games: 3n, wins: 2n },
        { ...zero, role_a: 'BOTTOM', role_b: 'UTILITY', tier: 'GOLD', team_id: 100, games: 1n, wins: 0n },
        { ...zero, role_a: 'BOTTOM', role_b: 'UTILITY', tier: 'GOLD', team_id: 200, games: 5n, wins: 1n },
        { ...zero, role_a: 'JUNGLE', role_b: 'MIDDLE', tier: 'IRON', team_id: 200, games: 2, wins: 1 },
      ])
    ).toEqual([
      { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', side: 'BLUE', games: 4, wins: 2, ...duoTail },
      { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', side: 'RED', games: 5, wins: 1, ...duoTail },
      { roleA: 'JUNGLE', roleB: 'MIDDLE', tier: 'IRON', side: 'RED', games: 2, wins: 1, ...duoTail },
    ]);
  });

  it('abandons pour/contre, AFK du duo, objectifs de l’équipe et adverses sommés', () => {
    const row = {
      ...zero,
      role_a: 'TOP',
      role_b: 'JUNGLE',
      tier: 'GOLD',
      team_id: 100,
      games: 2n,
      wins: 1n,
      surr_for: 1n,
      surr_against: 1n,
      afk: 1n,
      own_dragons: 3n,
      enemy_dragons: 2n,
      own_barons: 1n,
      enemy_towers: 4n,
      own_grubs: 6n,
      enemy_heralds: 1n,
    };
    expect(mergeDuoRows([row, row])).toEqual([
      {
        roleA: 'TOP',
        roleB: 'JUNGLE',
        tier: 'GOLD',
        side: 'BLUE',
        games: 4,
        wins: 2,
        surrenderFor: 2,
        surrenderAgainst: 2,
        afk: 2,
        objectives: {
          dragons: { own: 6, enemy: 4 },
          barons: { own: 2, enemy: 0 },
          towers: { own: 0, enemy: 8 },
          grubs: { own: 12, enemy: 0 },
          heralds: { own: 0, enemy: 2 },
        },
      },
    ]);
  });

  it('ignore rôles, tier ou côté absents', () => {
    const base = { ...zero, games: 1, wins: 1 };
    expect(mergeDuoRows([{ ...base, role_a: null, role_b: 'TOP', tier: 'GOLD', team_id: 100 }])).toEqual([]);
    expect(mergeDuoRows([{ ...base, role_a: 'TOP', role_b: 'MIDDLE', tier: null, team_id: 100 }])).toEqual([]);
    expect(mergeDuoRows([{ ...base, role_a: 'TOP', role_b: 'MIDDLE', tier: 'GOLD', team_id: null }])).toEqual([]);
  });
});

describe('mergeDuoPicks', () => {
  it('champion joué par chaque rôle de la paire, paire rangée TOP→UTILITY', () => {
    expect(
      mergeDuoPicks([
        { role_self: 'UTILITY', role_other: 'BOTTOM', tier: 'GOLD', champion: 412, games: 3n, wins: 2n },
        { role_self: 'BOTTOM', role_other: 'UTILITY', tier: 'GOLD', champion: 22, games: 4n, wins: 1n },
        { role_self: 'BOTTOM', role_other: 'UTILITY', tier: null, champion: 22, games: 4n, wins: 1n },
        { role_self: 'BOTTOM', role_other: 'UTILITY', tier: 'GOLD', champion: null, games: 1n, wins: 1n },
      ])
    ).toEqual([
      { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', role: 'UTILITY', championId: 412, games: 3, wins: 2 },
      { roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', role: 'BOTTOM', championId: 22, games: 4, wins: 1 },
    ]);
  });
});

describe('mergeDuoBans', () => {
  it('bans de l’équipe du duo, fusionnés par paire rangée', () => {
    expect(
      mergeDuoBans([
        { role_a: 'UTILITY', role_b: 'BOTTOM', tier: 'GOLD', champion: 157, bans: 2n },
        { role_a: 'BOTTOM', role_b: 'UTILITY', tier: 'GOLD', champion: 157, bans: 3n },
        { role_a: 'BOTTOM', role_b: 'UTILITY', tier: 'GOLD', champion: null, bans: 3n },
      ])
    ).toEqual([{ roleA: 'BOTTOM', roleB: 'UTILITY', tier: 'GOLD', championId: 157, bans: 5 }]);
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
      .mockResolvedValueOnce([{ ...zero, role_a: 'TOP', role_b: 'JUNGLE', tier: 'GOLD', team_id: 200, games: 5n, wins: 3n }])
      .mockResolvedValueOnce([{ role_self: 'TOP', role_other: 'JUNGLE', tier: 'GOLD', champion: 86, games: 5n, wins: 3n }])
      .mockResolvedValueOnce([{ role_a: 'TOP', role_b: 'JUNGLE', tier: 'GOLD', champion: 157, bans: 4n }]);
    const data = await getTeamMiscStats('16.1');
    expect(data).toEqual({
      afk: [
        { role: 'TOP', tier: 'GOLD', side: 'BLUE', games: 10, afk: 1 },
        { role: 'TOP', tier: 'GOLD', side: 'RED', games: 8, afk: 2 },
      ],
      duos: [{ roleA: 'TOP', roleB: 'JUNGLE', tier: 'GOLD', side: 'RED', games: 5, wins: 3, ...duoTail }],
      duoPicks: [{ roleA: 'TOP', roleB: 'JUNGLE', tier: 'GOLD', role: 'TOP', championId: 86, games: 5, wins: 3 }],
      duoBans: [{ roleA: 'TOP', roleB: 'JUNGLE', tier: 'GOLD', championId: 157, bans: 4 }],
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
    expect(duoSql).toContain('m.surrender');
    expect(duoSql).toContain('pb.was_afk');
    expect(duoSql).toContain('te.team_id <> pa.team_id');
    const [pickSql] = queryMock.mock.calls[2];
    expect(pickSql).toContain('champion_b');
    expect(pickSql).toContain('ROW_NUMBER()');
    const [banSql] = queryMock.mock.calls[3];
    expect(banSql).toContain('id_champion_ban');
    expect(banSql).toContain('pt.team_id = pa.team_id');
  });

  it('filtre région sur les deux requêtes, cache par région', async () => {
    queryMock.mockResolvedValue([]);
    await runWithStatsRegion(['KR'], () => getTeamMiscStats('16.9'));
    expect(queryMock.mock.calls[0][0]).toContain("m.region = 'KR'");
    expect(queryMock.mock.calls[1][0]).toContain("d.region = 'KR'");
    expect(queryMock.mock.calls[2][0]).toContain("d.region = 'KR'");
    expect(queryMock.mock.calls[3][0]).toContain("d.region = 'KR'");
    const calls = queryMock.mock.calls.length;
    await runWithStatsRegion(['KR'], () => getTeamMiscStats('16.9'));
    expect(queryMock).toHaveBeenCalledTimes(calls);
    await runWithStatsRegion(['EUW1'], () => getTeamMiscStats('16.9'));
    expect(queryMock.mock.calls.length).toBeGreaterThan(calls);
  });

  it('deux appels simultanés : une seule requête (calcul ~10 s)', async () => {
    queryMock.mockResolvedValue([]);
    await Promise.all([getTeamMiscStats('15.1'), getTeamMiscStats('15.1')]);
    expect(queryMock).toHaveBeenCalledTimes(4);
  });
});
