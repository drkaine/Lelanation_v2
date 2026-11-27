/**
 * Balayage des rangs par pages league-v4 (205 joueurs par requête), chaque jour dès 00:01 (heure locale) :
 * ligues apex, puis N pages par tier/division. Chaque division garde son curseur de page d'un jour à
 * l'autre (jour 1 pages 1-10, jour 2 pages 11-20…) et reboucle à la page 1 après une page vide.
 * Les joueurs balayés sont les cibles de poll du jour, à peu près autant par tier.
 * Logique pure : l'état est sérialisé en jsonb par LeagueSweeper.
 */
export const APEX_LEAGUES = ['challengerleagues', 'grandmasterleagues', 'masterleagues'] as const;
export type ApexLeague = (typeof APEX_LEAGUES)[number];

export const APEX_TIER: Record<ApexLeague, string> = {
  challengerleagues: 'CHALLENGER',
  grandmasterleagues: 'GRANDMASTER',
  masterleagues: 'MASTER',
};

const TIERS = ['DIAMOND', 'EMERALD', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'IRON'] as const;
const DIVISIONS = ['I', 'II', 'III', 'IV'] as const;
/** Taille d'une page league-v4 entries. */
export const LEAGUE_PAGE_SIZE = 205;

export const SWEEP_COMBOS: ReadonlyArray<{ tier: string; division: string }> = TIERS.flatMap((tier) =>
  DIVISIONS.map((division) => ({ tier, division })),
);

const SOLO_QUEUE = 'RANKED_SOLO_5x5';
/** Le jour du balayage bascule à 00:01 : décalage d'une minute. */
const DAY_START_OFFSET_MS = 60_000;
const IDLE_DELAY_MS = 60_000;
const DAY_MS = 86_400_000;

export interface SweepState {
  day: string;
  apexDone: string[];
  /** Division en cours (index dans SWEEP_COMBOS). */
  combo: number;
  /** Pages non vides lues aujourd'hui dans la division en cours. */
  pagesToday: number;
  /** Prochaine page de chaque division, conservée d'un jour à l'autre. */
  cursors: number[];
  done: boolean;
  /** Tours de pages en plus aujourd'hui (rallonges quand toutes les cibles sont pollées). */
  rounds: number;
  /** Joueurs pollés par jour, 7 derniers jours (dimensionne le balayage). */
  polledHistory: number[];
  /** Pages par division du jour ; null = valeur configurée. */
  pages: number | null;
  /** Cibles apex (Master+) retenues aujourd'hui : déduites du besoin le lendemain. */
  apexTargets: number;
}

export type SweepStep =
  | { kind: 'apex'; league: ApexLeague }
  | { kind: 'page'; tier: string; division: string; page: number }
  | { kind: 'idle' };

export interface RankRow {
  puuid: string;
  tier: string;
  division: string;
  lp: number;
}

export function initialSweepState(day: string): SweepState {
  return { day, apexDone: [], combo: 0, pagesToday: 0, cursors: SWEEP_COMBOS.map(() => 1), done: false, rounds: 0, polledHistory: [], pages: null, apexTargets: 0 };
}

const POLLED_HISTORY_DAYS = 7;
/** Marge sur les joueurs pollés : on récupère 5 % de rangs en plus. */
const SIZING_MARGIN = 1.05;

export function pushPolledHistory(history: readonly number[], count: number): number[] {
  return [...history, Math.max(0, Math.floor(count))].slice(-POLLED_HISTORY_DAYS);
}

/**
 * Pages par division = (moyenne des joueurs pollés × 1,05 − cibles apex) / (205 × 28 divisions),
 * entre 1 et `maxPages` : les Master+ déjà ciblés n'appellent pas de pages, budget gardé pour les matchs.
 * Sans historique : `fallback`.
 */
export function sizedPagesPerDivision(
  history: readonly number[],
  fallback: number,
  maxPages: number,
  apexTargets = 0,
): number {
  if (history.length === 0) return fallback;
  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  const needed = avg * SIZING_MARGIN - Math.max(0, apexTargets);
  const pages = Math.ceil(needed / (LEAGUE_PAGE_SIZE * SWEEP_COMBOS.length));
  return Math.min(Math.max(1, maxPages), Math.max(1, pages));
}

/** Veille de `day` (YYYY-MM-DD). */
export function previousSweepDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Jour local (YYYY-MM-DD) du balayage : commence à 00:01. */
export function sweepDay(now: Date): string {
  const shifted = new Date(now.getTime() - DAY_START_OFFSET_MS);
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${shifted.getFullYear()}-${month}-${day}`;
}

/**
 * Instant de début du jour `day` (00:01 local). À comparer aux timestamptz : `${day}::date` côté
 * Postgres (session UTC) vaut minuit UTC, soit 01:00 Paris — de 00:01 à 01:00 les joueurs déjà pollés
 * redevenaient éligibles et le poller tournait à vide (26/11 23:08–23:50 UTC).
 */
export function sweepDayStart(day: string): Date {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number);
  return new Date(new Date(y, m - 1, d).getTime() + DAY_START_OFFSET_MS);
}

/** Joueurs ciblés par tier et par jour : N pages × 4 divisions. */
export function tierQuota(pagesPerDivision: number): number {
  return pagesPerDivision * DIVISIONS.length * LEAGUE_PAGE_SIZE;
}

/** Cibles d'une ligue apex (un seul appel) : tout si elle tient dans le quota, sinon une fenêtre tournante par jour. */
export function apexTargets<T>(rows: readonly T[], quota: number, day: string): T[] {
  if (rows.length <= quota) return [...rows];
  const dayIndex = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
  const offset = (((dayIndex * quota) % rows.length) + rows.length) % rows.length;
  return Array.from({ length: quota }, (_, i) => rows[(offset + i) % rows.length]);
}

/** Prochaine requête ; un nouveau jour refait les apex et toutes les divisions, curseurs conservés. */
export function planSweep(state: SweepState, today: string): { step: SweepStep; state: SweepState } {
  const current = state.day === today ? state : {
          ...initialSweepState(today),
          cursors: state.cursors,
          polledHistory: state.polledHistory,
          pages: state.pages,
        };
  if (current.done) return { step: { kind: 'idle' }, state: current };

  const apex = APEX_LEAGUES.find((league) => !current.apexDone.includes(league));
  if (apex) return { step: { kind: 'apex', league: apex }, state: current };

  const combo = SWEEP_COMBOS[current.combo];
  if (!combo) return { step: { kind: 'idle' }, state: { ...current, done: true } };
  const page = current.cursors[current.combo] ?? 1;
  return { step: { kind: 'page', tier: combo.tier, division: combo.division, page }, state: current };
}

/**
 * Avance l'état après une requête. Page pleine : curseur +1, division suivante au quota du jour.
 * Page vide : curseur remis à 1 ; si rien n'a encore été lu aujourd'hui, on reprend tout de suite à la page 1.
 */
export function recordSweep(
  state: SweepState,
  step: SweepStep,
  entryCount: number,
  pagesPerDivision: number,
): SweepState {
  if (step.kind === 'idle') return state;
  if (step.kind === 'apex') return { ...state, apexDone: [...state.apexDone, step.league] };
  const cursors = [...state.cursors];
  if (entryCount > 0) {
    cursors[state.combo] = step.page + 1;
    const pagesToday = state.pagesToday + 1;
    if (pagesToday < pagesPerDivision) return { ...state, cursors, pagesToday };
    return nextCombo({ ...state, cursors });
  }
  cursors[state.combo] = 1;
  if (state.pagesToday === 0 && step.page > 1) return { ...state, cursors };
  return nextCombo({ ...state, cursors });
}

function nextCombo(state: SweepState): SweepState {
  const combo = state.combo + 1;
  return { ...state, combo, pagesToday: 0, done: combo >= SWEEP_COMBOS.length };
}

/**
 * Rallonge : toutes les cibles du jour sont pollées → un tour de pages de plus (curseurs à la suite,
 * apex non refaits). Sécu : seulement balayage du jour fini, au plus `maxRounds` tours par jour.
 */
export function extendSweep(state: SweepState, maxRounds: number): SweepState | null {
  if (!state.done || state.rounds + 1 >= maxRounds) return null;
  return { ...state, done: false, combo: 0, pagesToday: 0, rounds: state.rounds + 1 };
}

/** Délai avant le tick suivant : intervalle minimal entre requêtes, une minute quand il n'y a rien à faire. */
export function sweepTickDelayMs(kind: SweepStep['kind'], minIntervalMs: number): number {
  return kind === 'idle' ? IDLE_DELAY_MS : minIntervalMs;
}

/** Entrées league → lignes de rang (file solo, puuid requis ; tier de la ligue apex en repli). */
export function toRankRows(entries: ReadonlyArray<Record<string, unknown>>, fallbackTier?: string): RankRow[] {
  const rows: RankRow[] = [];
  for (const entry of entries) {
    const { puuid, queueType, tier, rank, leaguePoints } = entry;
    if (typeof puuid !== 'string' || puuid === '') continue;
    if (queueType !== undefined && queueType !== SOLO_QUEUE) continue;
    const resolvedTier = typeof tier === 'string' && tier !== '' ? tier : fallbackTier;
    if (!resolvedTier || typeof rank !== 'string') continue;
    rows.push({ puuid, tier: resolvedTier, division: rank, lp: typeof leaguePoints === 'number' ? leaguePoints : 0 });
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Relit l'état jsonb (objet ou chaîne JSON) ; tout état invalide ou ancien repart de zéro. */
export function parseSweepState(raw: unknown, today: string): SweepState {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return initialSweepState(today);
    }
  }
  if (!isRecord(value)) return initialSweepState(today);
  const { day, apexDone, combo, pagesToday, cursors, done, rounds, polledHistory, pages, apexTargets } = value;
  if (typeof day !== 'string' || !Array.isArray(apexDone) || !Array.isArray(cursors)) return initialSweepState(today);
  if (typeof combo !== 'number' || typeof pagesToday !== 'number' || typeof done !== 'boolean') {
    return initialSweepState(today);
  }
  return {
    day,
    apexDone: apexDone.filter((item): item is string => typeof item === 'string'),
    combo: Math.max(0, Math.floor(combo)),
    pagesToday: Math.max(0, Math.floor(pagesToday)),
    cursors: SWEEP_COMBOS.map((_, i) => {
      const page = cursors[i];
      return typeof page === 'number' && page >= 1 ? Math.floor(page) : 1;
    }),
    done,
    rounds: typeof rounds === 'number' && rounds >= 0 ? Math.floor(rounds) : 0,
    polledHistory: Array.isArray(polledHistory)
      ? polledHistory.filter((n): n is number => typeof n === 'number' && n >= 0).slice(-POLLED_HISTORY_DAYS)
      : [],
    pages: typeof pages === 'number' && pages >= 1 ? Math.floor(pages) : null,
    apexTargets: typeof apexTargets === 'number' && apexTargets >= 0 ? Math.floor(apexTargets) : 0,
  };
}
