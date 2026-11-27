import { describe, expect, it, vi } from 'vitest';
import {
  LEAGUE_PAGE_SIZE,
  SWEEP_COMBOS,
  initialSweepState,
  parseSweepState,
  planSweep,
  previousSweepDay,
  pushPolledHistory,
  sizedPagesPerDivision,
} from '../../../../src/poll-orchestration/leagueSweep.js';
import { LeagueSweeper, type LeagueSweeperDeps } from '../../../../src/poll-orchestration/LeagueSweeper.js';

const PER_PAGE = LEAGUE_PAGE_SIZE * SWEEP_COMBOS.length;

describe('dimensionnement du balayage : joueurs pollés des derniers jours + 5 %', () => {
  it('pages = ceil(moyenne × 1,05 / joueurs par tour de pages)', () => {
    // moyenne = 2 × PER_PAGE → × 1,05 → 3 pages
    expect(sizedPagesPerDivision([PER_PAGE, 3 * PER_PAGE], 2, 20)).toBe(3);
    // pile 1 tour : la marge de 5 % en ajoute un
    expect(sizedPagesPerDivision([PER_PAGE], 2, 20)).toBe(2);
  });

  it('bornes : au moins 1, au plus le max ; sans historique = repli', () => {
    expect(sizedPagesPerDivision([0, 0], 2, 20)).toBe(1);
    expect(sizedPagesPerDivision([1_000 * PER_PAGE], 2, 20)).toBe(20);
    expect(sizedPagesPerDivision([], 2, 20)).toBe(2);
  });

  it('cibles Master+ de la veille déduites : moins de pages, plus de requêtes match', () => {
    // besoin 2 × PER_PAGE × 1,05 ; apex couvre 0,1 × PER_PAGE → 2 pages au lieu de 3
    expect(sizedPagesPerDivision([2 * PER_PAGE], 2, 20, 0.1 * PER_PAGE)).toBe(2);
    expect(sizedPagesPerDivision([2 * PER_PAGE], 2, 20, 0)).toBe(3);
    // apex couvre tout : plancher 1
    expect(sizedPagesPerDivision([PER_PAGE], 2, 20, 5 * PER_PAGE)).toBe(1);
  });

  it('état : apexTargets relu, absent = 0, remis à 0 un nouveau jour', () => {
    const s = parseSweepState({ ...initialSweepState('2026-11-26'), apexTargets: 812 }, '2026-11-26');
    expect(s.apexTargets).toBe(812);
    expect(parseSweepState({ ...initialSweepState('2026-11-26'), apexTargets: 'x' }, '2026-11-26').apexTargets).toBe(0);
    expect(planSweep(s, '2026-11-27').state.apexTargets).toBe(0);
  });

  it('historique glissant sur 7 jours', () => {
    expect(pushPolledHistory([1, 2, 3, 4, 5, 6, 7], 8)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(pushPolledHistory([], -3)).toEqual([0]);
  });

  it('jour précédent du balayage', () => {
    expect(previousSweepDay('2026-12-01')).toBe('2026-11-30');
    expect(previousSweepDay('2026-01-01')).toBe('2025-12-31');
  });

  it('état : historique et pages relus, conservés au changement de jour', () => {
    const raw = { ...initialSweepState('2026-11-26'), polledHistory: [10, 'x', 20], pages: 3 };
    const parsed = parseSweepState(raw, '2026-11-26');
    expect(parsed.polledHistory).toEqual([10, 20]);
    expect(parsed.pages).toBe(3);
    expect(parseSweepState({ ...raw, pages: 0 }, '2026-11-26').pages).toBeNull();
    const { state } = planSweep(parsed, '2026-11-27');
    expect(state).toMatchObject({ day: '2026-11-27', polledHistory: [10, 20], pages: 3, combo: 0 });
    expect(initialSweepState('2026-11-27')).toMatchObject({ polledHistory: [], pages: null });
  });
});

describe('LeagueSweeper : taille du jour calculée au premier tick du jour', () => {
  function deps(state: unknown, overrides: Partial<LeagueSweeperDeps> = {}) {
    const saved: Array<{ pages: number | null; polledHistory: number[]; apexTargets: number }> = [];
    const d: LeagueSweeperDeps = {
      today: () => '2026-11-27',
      loadState: async () => state,
      saveState: async (s) => {
        saved.push(s);
      },
      pagesPerDivision: 2,
      maxPagesPerDivision: 20,
      storeRanks: async (rows) => ({ stored: rows.length, newPlayers: 0 }),
      fetchApex: vi.fn(async () => ({ tier: 'CHALLENGER', entries: [] })),
      fetchPage: vi.fn(async () => []),
      ...overrides,
    };
    return { d, saved };
  }

  it('nouveau jour : compte les pollés de la veille, met à jour historique et pages', async () => {
    const countPolled = vi.fn(async () => 3 * PER_PAGE);
    const { d, saved } = deps({ ...initialSweepState('2026-11-26'), polledHistory: [3 * PER_PAGE] }, { countPolled });
    await new LeagueSweeper(d).tick();
    expect(countPolled).toHaveBeenCalledWith('2026-11-26', '2026-11-27');
    expect(saved[0]).toMatchObject({ polledHistory: [3 * PER_PAGE, 3 * PER_PAGE], pages: 4 });
  });

  it('nouveau jour : cibles apex de la veille déduites du besoin', async () => {
    const countPolled = vi.fn(async () => 3 * PER_PAGE);
    const { d, saved } = deps(
      { ...initialSweepState('2026-11-26'), polledHistory: [3 * PER_PAGE], apexTargets: PER_PAGE },
      { countPolled },
    );
    await new LeagueSweeper(d).tick();
    // 3 × 1,05 − 1 = 2,15 tours → 3 pages (4 sans déduction)
    expect(saved[0]).toMatchObject({ pages: 3 });
  });

  it('étape apex : cibles retenues ajoutées au compteur du jour', async () => {
    const entries = Array.from({ length: 300 }, (_, i) => ({ puuid: `c${i}`, rank: 'I', leaguePoints: i }));
    const { d, saved } = deps(
      { ...initialSweepState('2026-11-27'), pages: 3, apexTargets: 10 },
      { fetchApex: vi.fn(async () => ({ tier: 'CHALLENGER', entries })) },
    );
    await new LeagueSweeper(d).tick();
    expect(saved[0]?.apexTargets).toBe(310);
  });

  it('même jour : pas de recomptage', async () => {
    const countPolled = vi.fn(async () => 1);
    const { d } = deps({ ...initialSweepState('2026-11-27'), pages: 3 }, { countPolled });
    await new LeagueSweeper(d).tick();
    expect(countPolled).not.toHaveBeenCalled();
  });

  it('quota apex suit les pages du jour', async () => {
    const entries = Array.from({ length: 5000 }, (_, i) => ({ puuid: `m${i}`, rank: 'I', leaguePoints: i }));
    const targets: number[] = [];
    const { d } = deps(
      { ...initialSweepState('2026-11-27'), pages: 3 },
      {
        fetchApex: vi.fn(async () => ({ tier: 'MASTER', entries })),
        storeRanks: async (rows, _day, t) => {
          targets.push(t.length);
          return { stored: rows.length, newPlayers: 0 };
        },
      },
    );
    await new LeagueSweeper(d).tick();
    expect(targets[0]).toBe(3 * 4 * LEAGUE_PAGE_SIZE);
  });
});
