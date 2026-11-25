import { describe, expect, it } from 'vitest';
import {
  DUO_MIN_GAMES,
  DUO_MIN_SHARE,
  isDuoPair,
  orderPair,
  selectDuoSafeBatch,
} from '../../../../src/poll-orchestration/duoRules.js';

describe('isDuoPair', () => {
  it('seuils par défaut : 10 % et 3 parties', () => {
    expect(DUO_MIN_SHARE).toBe(0.1);
    expect(DUO_MIN_GAMES).toBe(3);
  });

  it('vrai si ≥ 10 % des parties de chaque joueur et ≥ 3 parties', () => {
    expect(isDuoPair(3, 30, 20)).toBe(true);
    expect(isDuoPair(5, 50, 10)).toBe(true);
  });

  it('faux si un des deux joueurs est sous 10 %', () => {
    expect(isDuoPair(3, 31, 20)).toBe(false);
    expect(isDuoPair(5, 10, 60)).toBe(false);
  });

  it('faux sous 3 parties ensemble', () => {
    expect(isDuoPair(2, 2, 2)).toBe(false);
  });
});

describe('orderPair', () => {
  it('met le plus petit puuid en a', () => {
    expect(orderPair('b', 'a')).toEqual(['a', 'b']);
    expect(orderPair('a', 'b')).toEqual(['a', 'b']);
  });
});

describe('selectDuoSafeBatch', () => {
  const row = (puuid: string, partners: string[] = []) => ({ puuid, region: 'EUW1', partners });

  it('déduplique et respecte la limite', () => {
    const out = selectDuoSafeBatch([row('a'), row('b'), row('a'), row('c')], 2, new Set());
    expect(out.map((r) => r.puuid)).toEqual(['a', 'b']);
  });

  it('écarte le partenaire de duo d’un joueur déjà retenu dans le lot', () => {
    const out = selectDuoSafeBatch([row('a', ['b']), row('b', ['a']), row('c')], 10, new Set());
    expect(out.map((r) => r.puuid)).toEqual(['a', 'c']);
  });

  it('écarte un joueur dont le partenaire a déjà été pollé aujourd’hui', () => {
    const out = selectDuoSafeBatch([row('a', ['x']), row('b')], 10, new Set(['x']));
    expect(out.map((r) => r.puuid)).toEqual(['b']);
  });
});
