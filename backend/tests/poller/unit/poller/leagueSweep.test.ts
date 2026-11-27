import { describe, expect, it } from 'vitest';
import {
  APEX_LEAGUES,
  SWEEP_COMBOS,
  apexTargets,
  extendSweep,
  initialSweepState,
  parseSweepState,
  planSweep,
  recordSweep,
  sweepDay,
  sweepDayStart,
  sweepTickDelayMs,
  tierQuota,
  toRankRows,
} from '../../../../src/poll-orchestration/leagueSweep.js';

const DAY = '2026-11-24';
const NEXT = '2026-11-25';

/** Parcourt une journée ; `lastPage` = dernière page non vide de chaque division. */
function walkDay(start: ReturnType<typeof initialSweepState>, day: string, perDivision: number, lastPage = 25) {
  const steps = [];
  let current = start;
  for (let i = 0; i < 10_000; i += 1) {
    const { step, state: next } = planSweep(current, day);
    if (step.kind === 'idle') return { steps, state: next };
    steps.push(step);
    const count = step.kind === 'page' && step.page > lastPage ? 0 : 205;
    current = recordSweep(next, step, count, perDivision);
  }
  throw new Error('le balayage ne se termine pas');
}

const pagesOf = (steps: ReturnType<typeof walkDay>['steps'], combo = 0) =>
  steps.filter((s) => s.kind === 'page' && s.tier === SWEEP_COMBOS[combo].tier && s.division === SWEEP_COMBOS[combo].division)
    .map((s) => (s.kind === 'page' ? s.page : 0));

describe('leagueSweep — jour du balayage', () => {
  it('le jour commence à 00:01 heure locale', () => {
    expect(sweepDay(new Date(2026, 10, 25, 0, 0, 30))).toBe('2026-11-24');
    expect(sweepDay(new Date(2026, 10, 25, 0, 1, 0))).toBe('2026-11-25');
    expect(sweepDay(new Date(2026, 10, 25, 15, 0, 0))).toBe('2026-11-25');
  });
});

describe('sweepDayStart — bascule de minuit (base en UTC, jour local)', () => {
  it('instant de début = minuit local + 1 min', () => {
    expect(sweepDayStart('2026-11-25').getTime()).toBe(new Date(2026, 10, 25, 0, 1, 0).getTime());
  });

  it('cohérent avec sweepDay : début inclus, la minute d’avant = veille', () => {
    const start = sweepDayStart('2026-11-25');
    expect(sweepDay(start)).toBe('2026-11-25');
    expect(sweepDay(new Date(start.getTime() - 1))).toBe('2026-11-24');
  });

  it('joueur pollé à 00:10 local (veille en UTC) : déjà pollé « aujourd’hui »', () => {
    const polledAt = new Date(2026, 10, 25, 0, 10, 0);
    expect(polledAt.getTime() >= sweepDayStart(sweepDay(polledAt)).getTime()).toBe(true);
  });
});

describe('leagueSweep — quota de pages tournant', () => {
  it('apex puis N pages par division, puis idle', () => {
    const { steps, state } = walkDay(initialSweepState(DAY), DAY, 2);
    expect(steps.slice(0, 3).map((s) => (s.kind === 'apex' ? s.league : ''))).toEqual([...APEX_LEAGUES]);
    expect(steps.filter((s) => s.kind === 'page')).toHaveLength(SWEEP_COMBOS.length * 2);
    expect(pagesOf(steps)).toEqual([1, 2]);
    expect(state.done).toBe(true);
  });

  it('le jour suivant reprend aux pages suivantes, apex refaits', () => {
    const day1 = walkDay(initialSweepState(DAY), DAY, 10);
    const day2 = walkDay(day1.state, NEXT, 10);
    expect(pagesOf(day1.steps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(pagesOf(day2.steps)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(day2.steps.filter((s) => s.kind === 'apex')).toHaveLength(3);
  });

  it('page vide : la division reboucle à la page 1', () => {
    const day1 = walkDay(initialSweepState(DAY), DAY, 10, 25);
    const day2 = walkDay(day1.state, NEXT, 10, 25);
    const day3 = walkDay(day2.state, '2026-11-26', 10, 25);
    const day4 = walkDay(day3.state, '2026-11-27', 10, 25);
    expect(pagesOf(day3.steps)).toEqual([21, 22, 23, 24, 25, 26]);
    expect(pagesOf(day4.steps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('curseur déjà au-delà de la fin : repart de la page 1 le jour même', () => {
    const start = { ...initialSweepState(DAY), apexDone: [...APEX_LEAGUES], cursors: SWEEP_COMBOS.map(() => 40) };
    const { steps } = walkDay(start, DAY, 2, 25);
    expect(pagesOf(steps)).toEqual([40, 1, 2]);
  });

  it('division vide (aucun joueur) : passe sans boucler', () => {
    const { state } = walkDay(initialSweepState(DAY), DAY, 2, 0);
    expect(state.done).toBe(true);
  });

  it('reprend où il en était après un redémarrage', () => {
    const cursors = SWEEP_COMBOS.map(() => 1);
    cursors[5] = 12;
    const mid = { ...initialSweepState(DAY), apexDone: [...APEX_LEAGUES], combo: 5, cursors };
    expect(planSweep(mid, DAY).step).toEqual({ kind: 'page', ...SWEEP_COMBOS[5], page: 12 });
  });

  it('rythme : intervalle minimal entre requêtes, une minute quand idle', () => {
    expect(sweepTickDelayMs('page', 1500)).toBe(1500);
    expect(sweepTickDelayMs('idle', 1500)).toBe(60_000);
  });
});

describe('leagueSweep — rallonge quand toutes les cibles sont pollées', () => {
  it('jour fini : un nouveau tour de pages, sans refaire les apex, curseurs à la suite', () => {
    const day1 = walkDay(initialSweepState(DAY), DAY, 2);
    const extended = extendSweep(day1.state, 3);
    expect(extended).not.toBeNull();
    const round2 = walkDay(extended ?? day1.state, DAY, 2);
    expect(round2.steps.some((s) => s.kind === 'apex')).toBe(false);
    expect(pagesOf(round2.steps)).toEqual([3, 4]);
    expect(round2.state.rounds).toBe(1);
  });

  it('sécu : pas plus de N tours par jour, pas de rallonge pendant un balayage', () => {
    let current = walkDay(initialSweepState(DAY), DAY, 2).state;
    for (let i = 0; i < 2; i += 1) {
      const next = extendSweep(current, 3);
      expect(next).not.toBeNull();
      current = walkDay(next ?? current, DAY, 2).state;
    }
    expect(extendSweep(current, 3)).toBeNull();
    expect(extendSweep(initialSweepState(DAY), 3)).toBeNull();
  });

  it('nouveau jour : compteur de tours remis à 0', () => {
    const extended = extendSweep(walkDay(initialSweepState(DAY), DAY, 2).state, 3);
    expect(planSweep(extended ?? initialSweepState(DAY), NEXT).state.rounds).toBe(0);
  });
});

describe('leagueSweep — cibles apex', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ puuid: `p${i}`, tier: 'MASTER', division: 'I', lp: i }));

  it('quota par tier = pages × 4 divisions × 205', () => {
    expect(tierQuota(2)).toBe(1640);
  });

  it('ligue plus petite que le quota : tout le monde', () => {
    expect(apexTargets(rows, 20, DAY)).toHaveLength(10);
  });

  it('ligue plus grande : quota, fenêtre tournante selon le jour', () => {
    const a = apexTargets(rows, 4, DAY).map((r) => r.puuid);
    const b = apexTargets(rows, 4, NEXT).map((r) => r.puuid);
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    expect(new Set([...a, ...b]).size).toBe(8);
  });
});

describe('leagueSweep — lignes de rang', () => {
  it('garde la file solo et les entrées avec puuid, tier apex en repli', () => {
    const rows = toRankRows(
      [
        { puuid: 'a', tier: 'GOLD', rank: 'II', leaguePoints: 40, queueType: 'RANKED_SOLO_5x5' },
        { puuid: 'b', rank: 'I', leaguePoints: 900 },
        { puuid: 'c', tier: 'GOLD', rank: 'I', leaguePoints: 1, queueType: 'RANKED_FLEX_SR' },
        { tier: 'GOLD', rank: 'I', leaguePoints: 1 },
      ],
      'MASTER',
    );
    expect(rows).toEqual([
      { puuid: 'a', tier: 'GOLD', division: 'II', lp: 40 },
      { puuid: 'b', tier: 'MASTER', division: 'I', lp: 900 },
    ]);
  });
});

describe('leagueSweep — état persistant', () => {
  it('relit un état valide, y compris sérialisé en chaîne jsonb', () => {
    const state = { ...initialSweepState(DAY), combo: 2, pagesToday: 1, apexDone: ['challengerleagues'] };
    expect(parseSweepState(JSON.parse(JSON.stringify(state)), DAY)).toEqual(state);
    expect(parseSweepState(JSON.stringify(state), DAY)).toEqual(state);
  });

  it('rejette un état invalide ou à l’ancien format', () => {
    expect(parseSweepState(null, DAY)).toEqual(initialSweepState(DAY));
    expect(parseSweepState('pas du json', DAY)).toEqual(initialSweepState(DAY));
    expect(parseSweepState({ day: DAY, apexDone: [], combo: 0, page: 4, done: false }, DAY)).toEqual(
      initialSweepState(DAY),
    );
    const { rounds: _rounds, ...withoutRounds } = { ...initialSweepState(DAY), combo: 3 };
    expect(parseSweepState(withoutRounds, DAY)).toEqual({ ...initialSweepState(DAY), combo: 3 });
  });
});
