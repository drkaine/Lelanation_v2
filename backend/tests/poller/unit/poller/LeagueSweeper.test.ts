import { describe, expect, it, vi } from 'vitest';
import { LeagueSweeper, type LeagueSweeperDeps } from '../../../../src/poll-orchestration/LeagueSweeper.js';
import { APEX_LEAGUES, SWEEP_COMBOS, type SweepState } from '../../../../src/poll-orchestration/leagueSweep.js';

const DAY = '2026-11-24';

function deps(state: unknown, overrides: Partial<LeagueSweeperDeps> = {}) {
  const saved: SweepState[] = [];
  const stored: Array<{ rows: Array<{ puuid: string; tier: string }>; day: string; targets: string[] }> = [];
  const d: LeagueSweeperDeps = {
    today: () => DAY,
    loadState: async () => state,
    saveState: async (s) => {
      saved.push(s);
    },
    pagesPerDivision: 2,
    storeRanks: async (rows, day, targets) => {
      stored.push({ rows, day, targets: targets.map((t) => t.puuid) });
      return { stored: rows.length, newPlayers: 1 };
    },
    fetchApex: vi.fn(async () => ({ tier: 'CHALLENGER', entries: [{ puuid: 'x', rank: 'I', leaguePoints: 1200 }] })),
    fetchPage: vi.fn(async () => [{ puuid: 'y', tier: 'GOLD', rank: 'IV', leaguePoints: 3, queueType: 'RANKED_SOLO_5x5' }]),
    ...overrides,
  };
  return { d, saved, stored };
}

function state(page: number) {
  return { day: DAY, apexDone: [...APEX_LEAGUES], combo: 0, pagesToday: 0, cursors: SWEEP_COMBOS.map(() => page), done: false };
}

describe('LeagueSweeper.tick', () => {
  it('apex : tier de la ligue appliqué, rangs stockés, état sauvé', async () => {
    const { d, saved, stored } = deps(null);
    const result = await new LeagueSweeper(d).tick();
    expect(d.fetchApex).toHaveBeenCalledWith('challengerleagues');
    expect(stored[0]).toEqual({
      rows: [{ puuid: 'x', tier: 'CHALLENGER', division: 'I', lp: 1200 }],
      day: DAY,
      targets: ['x'],
    });
    expect(saved[0]).toMatchObject({ apexDone: ['challengerleagues'] });
    expect(result).toEqual({ kind: 'apex', entries: 1, stored: 1, newPlayers: 1 });
  });

  it('apex trop grande : rangs tous stockés, cibles limitées au quota du tier', async () => {
    const entries = Array.from({ length: 2000 }, (_, i) => ({ puuid: `m${i}`, rank: 'I', leaguePoints: i }));
    const { d, stored } = deps(
      { ...state(7), apexDone: ['challengerleagues', 'grandmasterleagues'] },
      { fetchApex: vi.fn(async () => ({ tier: 'MASTER', entries })) },
    );
    await new LeagueSweeper(d).tick();
    expect(stored[0].rows).toHaveLength(2000);
    expect(stored[0].targets).toHaveLength(1640);
  });

  it('page tier/division après les apex : tous ciblés, curseur avancé', async () => {
    const { d, saved, stored } = deps(state(7));
    const result = await new LeagueSweeper(d).tick();
    expect(d.fetchPage).toHaveBeenCalledWith('DIAMOND', 'I', 7);
    expect(stored[0].targets).toEqual(['y']);
    expect(saved[0]).toMatchObject({ combo: 0, pagesToday: 1 });
    expect(saved[0].cursors[0]).toBe(8);
    expect(result).toEqual({ kind: 'page', entries: 1, stored: 1, newPlayers: 1 });
  });

  it('page vide : division suivante, sans écriture de rangs', async () => {
    const { d, saved, stored } = deps(
      { ...state(40), pagesToday: 1 },
      { fetchPage: vi.fn(async () => []) },
    );
    const result = await new LeagueSweeper(d).tick();
    expect(stored).toHaveLength(0);
    expect(saved[0]).toMatchObject({ combo: 1, pagesToday: 0 });
    expect(saved[0].cursors[0]).toBe(1);
    expect(result).toEqual({ kind: 'page', entries: 0, stored: 0, newPlayers: 0 });
  });

  it('balayage du jour fini : aucune requête', async () => {
    const { d, saved } = deps({ ...state(1), combo: 28, done: true });
    const result = await new LeagueSweeper(d).tick();
    expect(d.fetchPage).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
    expect(result).toEqual({ kind: 'idle', entries: 0, stored: 0, newPlayers: 0 });
  });

  it('échec Riot : état non avancé, erreur remontée', async () => {
    const { d, saved } = deps(null, { fetchApex: vi.fn(async () => Promise.reject(new Error('429'))) });
    await expect(new LeagueSweeper(d).tick()).rejects.toThrow('429');
    expect(saved).toHaveLength(0);
  });
});

describe('LeagueSweeper.extend', () => {
  it('balayage du jour fini : relance un tour et sauve', async () => {
    const { d, saved } = deps({ ...state(5), done: true });
    expect(await new LeagueSweeper(d).extend(3)).toBe(true);
    expect(saved[0]).toMatchObject({ done: false, combo: 0, rounds: 1 });
  });

  it('balayage en cours ou tours épuisés : rien', async () => {
    const running = deps(state(5));
    expect(await new LeagueSweeper(running.d).extend(3)).toBe(false);
    const capped = deps({ ...state(5), done: true, rounds: 2 });
    expect(await new LeagueSweeper(capped.d).extend(3)).toBe(false);
    expect(running.saved).toHaveLength(0);
    expect(capped.saved).toHaveLength(0);
  });
});
