import { describe, expect, test } from 'vitest';
import { playerSinceTimestamp, RollingIdSet, POLL_WINDOW_MS } from '../../../../src/poller/playerSinceWindow.js';

const NOW = Date.UTC(2026, 10, 25, 12);
const sec = (ms: number) => Math.floor(ms / 1000);

describe('playerSinceTimestamp', () => {
  test('jamais pollé : 48 dernières heures', () => {
    expect(playerSinceTimestamp(0, null, NOW)).toBe(sec(NOW - POLL_WINDOW_MS));
  });
  test('dernier poll il y a plus de 48 h : 48 dernières heures', () => {
    const last = new Date(NOW - 5 * 24 * 3_600_000);
    expect(playerSinceTimestamp(0, last, NOW)).toBe(sec(NOW - POLL_WINDOW_MS));
  });
  test('dernier poll il y a moins de 48 h : depuis le dernier poll', () => {
    const last = new Date(NOW - 10 * 3_600_000);
    expect(playerSinceTimestamp(0, last, NOW)).toBe(sec(last.getTime()));
  });
  test('fenêtre globale plus récente (clé perso 24 h) : la garde', () => {
    const global = sec(NOW - 24 * 3_600_000);
    expect(playerSinceTimestamp(global, null, NOW)).toBe(global);
  });
});

describe('RollingIdSet', () => {
  test('un id reste connu après une rotation, oublié après deux', () => {
    const ids = new RollingIdSet();
    ids.add('EUW1_1');
    ids.rotate();
    expect(ids.has('EUW1_1')).toBe(true);
    ids.add('EUW1_2');
    ids.rotate();
    expect(ids.has('EUW1_1')).toBe(false);
    expect(ids.has('EUW1_2')).toBe(true);
  });
  test('est un Set : add, has, taille de la génération courante', () => {
    const ids: Set<string> = new RollingIdSet();
    ids.add('a');
    expect(ids.has('a')).toBe(true);
    expect(ids.size).toBe(1);
  });
});
