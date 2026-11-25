import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAMES_PER_DAY,
  NEXT_POLL_AFTER_GAME_SQL,
  POLL_DELAY_SQL,
  MAX_POLL_DELAY_DAYS,
  MIN_POLL_DELAY_DAYS,
  TARGET_NEW_GAMES,
  estimateGamesPerDay,
  gamesPerDayAfterPoll,
  pollDelayDays,
} from '../../../../src/poll-orchestration/pollYield.js';

const DAY_MS = 86_400_000;

describe('pollYield — rendement', () => {
  it('parties par jour = ids classés / jours de la fenêtre', () => {
    const now = Date.UTC(2026, 10, 24);
    const since = (now - 10 * DAY_MS) / 1000;
    expect(estimateGamesPerDay(30, since, now)).toBe(3);
  });

  it('fenêtre de moins d’un jour comptée comme un jour ; fenêtre absente → défaut', () => {
    const now = Date.UTC(2026, 10, 24);
    expect(estimateGamesPerDay(4, now / 1000 - 3600, now)).toBe(4);
    expect(estimateGamesPerDay(4, undefined, now)).toBe(DEFAULT_GAMES_PER_DAY);
  });

  it('délai = parties visées / rythme, borné', () => {
    expect(pollDelayDays(TARGET_NEW_GAMES / 5)).toBe(5);
    expect(pollDelayDays(1000)).toBe(MIN_POLL_DELAY_DAYS);
    expect(pollDelayDays(0)).toBe(MAX_POLL_DELAY_DAYS);
    expect(pollDelayDays(null)).toBe(pollDelayDays(DEFAULT_GAMES_PER_DAY));
  });
});

describe('pollYield — fin de poll', () => {
  const now = Date.UTC(2026, 10, 24);
  const since = (now - 10 * DAY_MS) / 1000;
  const stats = { matchIdsDiscovered: 20, errors: [] as unknown[] };

  it('poll réussi : rythme mesuré', () => {
    expect(gamesPerDayAfterPoll({ stats, sinceTimestamp: since }, now)).toBe(2);
  });

  it('erreur fatale, fenêtre inconnue : pas de rythme (on garde l’ancien)', () => {
    expect(gamesPerDayAfterPoll({ stats: { ...stats, errors: [{ fatal: true }] }, sinceTimestamp: since }, now)).toBeUndefined();
    expect(gamesPerDayAfterPoll({ stats }, now)).toBeUndefined();
  });
});

describe('pollYield — anti-chevauchement à l’ingestion', () => {
  it('une partie ingérée repousse next_poll_at de chaque participant (jamais en arrière)', () => {
    expect(NEXT_POLL_AFTER_GAME_SQL).toBe(`GREATEST(COALESCE(next_poll_at, '-infinity'::timestamptz), `);
    expect(POLL_DELAY_SQL).toContain('games_per_day');
    expect(POLL_DELAY_SQL).toContain(`${MIN_POLL_DELAY_DAYS}::float8`);
    expect(POLL_DELAY_SQL).toContain(`${MAX_POLL_DELAY_DAYS}::float8`);
  });
});
