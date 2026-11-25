/**
 * Priorité par rendement : un joueur est repollé quand il a probablement joué
 * TARGET_NEW_GAMES nouvelles parties classées. Les gros joueurs reviennent vite,
 * les inactifs attendent. `players.next_poll_at` porte la date, indexée.
 * Anti-chevauchement : toute partie ingérée repousse aussi la date de ses 10 joueurs.
 */
const DAY_MS = 86_400_000;

export const TARGET_NEW_GAMES = 5;
export const DEFAULT_GAMES_PER_DAY = 1;
export const MIN_POLL_DELAY_DAYS = 0.25;
export const MAX_POLL_DELAY_DAYS = 30;

/** Rythme observé : ids classés de la fenêtre / jours de la fenêtre (1 jour minimum). */
export function estimateGamesPerDay(matchIds: number, sinceTimestampSec: number | undefined, nowMs: number): number {
  if (sinceTimestampSec === undefined || !Number.isFinite(sinceTimestampSec)) return DEFAULT_GAMES_PER_DAY;
  const days = Math.max(1, (nowMs - sinceTimestampSec * 1000) / DAY_MS);
  return matchIds / days;
}

/** Délai avant le prochain poll, en jours, borné. */
export function pollDelayDays(gamesPerDay: number | null): number {
  const rate = gamesPerDay ?? DEFAULT_GAMES_PER_DAY;
  if (rate <= 0) return MAX_POLL_DELAY_DAYS;
  return Math.min(MAX_POLL_DELAY_DAYS, Math.max(MIN_POLL_DELAY_DAYS, TARGET_NEW_GAMES / rate));
}

/** Même délai en SQL, pour l'ingestion (colonne games_per_day du joueur). */
export const POLL_DELAY_SQL = `LEAST(${MAX_POLL_DELAY_DAYS}::float8, GREATEST(${MIN_POLL_DELAY_DAYS}::float8, CASE WHEN COALESCE(games_per_day, ${DEFAULT_GAMES_PER_DAY}) <= 0 THEN ${MAX_POLL_DELAY_DAYS}::float8 ELSE ${TARGET_NEW_GAMES}::float8 / COALESCE(games_per_day, ${DEFAULT_GAMES_PER_DAY}) END)) * interval '1 day'`;

interface PollCompletion {
  stats: { matchIdsDiscovered: number; errors: ReadonlyArray<unknown> };
  sinceTimestamp?: number;
}

function isFatal(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'fatal' in error && error.fatal === true;
}

/** Rythme à enregistrer après un poll ; undefined si la mesure n'est pas fiable. */
export function gamesPerDayAfterPoll(event: PollCompletion, nowMs: number): number | undefined {
  if (event.sinceTimestamp === undefined) return undefined;
  if (event.stats.errors.some(isFatal)) return undefined;
  return estimateGamesPerDay(event.stats.matchIdsDiscovered, event.sinceTimestamp, nowMs);
}

/** Début de `next_poll_at = GREATEST(…, <date de la partie> + POLL_DELAY_SQL)` : jamais en arrière. */
export const NEXT_POLL_AFTER_GAME_SQL = `GREATEST(COALESCE(next_poll_at, '-infinity'::timestamptz), `;
