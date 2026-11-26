import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createLimitsStore, parseLimits, type LimitSpec } from '../../../../src/services/limitsStore.js';

type L = Record<'a' | 'b', number>;
const SPECS: LimitSpec<L>[] = [
  { key: 'a', min: 1, integer: true },
  { key: 'b', min: 0, max: 100 },
];
const defaults = (): L => ({ a: 10, b: 0.5 });

const tmpFile = () => join(mkdtempSync(join(tmpdir(), 'limits-')), 'l.json');

describe('parseLimits', () => {
  it('accepte des valeurs dans les bornes', () => {
    expect(parseLimits(SPECS, { a: 3, b: 100 })).toEqual({ a: 3, b: 100 });
  });
  it('refuse hors bornes, non entier, manquant, non numérique', () => {
    expect(parseLimits(SPECS, { a: 0, b: 1 })).toBeNull();
    expect(parseLimits(SPECS, { a: 1.5, b: 1 })).toBeNull();
    expect(parseLimits(SPECS, { a: 2, b: 101 })).toBeNull();
    expect(parseLimits(SPECS, { a: 2 })).toBeNull();
    expect(parseLimits(SPECS, { a: '2', b: 1 })).toBeNull();
    expect(parseLimits(SPECS, null)).toBeNull();
  });
  it('contrôle croisé', () => {
    expect(parseLimits(SPECS, { a: 5, b: 3 }, (l) => l.b <= l.a)).toEqual({ a: 5, b: 3 });
    expect(parseLimits(SPECS, { a: 2, b: 3 }, (l) => l.b <= l.a)).toBeNull();
  });
});

describe('createLimitsStore', () => {
  it('fichier absent → défauts ; update écrit et applique', () => {
    const file = tmpFile();
    const store = createLimitsStore({ file: () => file, specs: SPECS, defaults });
    expect(store.get()).toEqual({ a: 10, b: 0.5 });
    expect(store.update({ a: 4, b: 2 })).toEqual({ ok: true, settings: { a: 4, b: 2 } });
    expect(store.get()).toEqual({ a: 4, b: 2 });
    expect(store.update({ a: 0, b: 2 })).toEqual({ ok: false });
    expect(store.get()).toEqual({ a: 4, b: 2 });
  });
  it("relit le fichier modifié par un autre process (poller)", () => {
    const file = tmpFile();
    const store = createLimitsStore({ file: () => file, specs: SPECS, defaults, recheckMs: 0 });
    expect(store.get().a).toBe(10);
    writeFileSync(file, JSON.stringify({ a: 7, b: 1 }));
    expect(store.get()).toEqual({ a: 7, b: 1 });
  });
  it('fichier invalide → défauts', () => {
    const file = tmpFile();
    writeFileSync(file, '{oops');
    const store = createLimitsStore({ file: () => file, specs: SPECS, defaults, recheckMs: 0 });
    expect(store.get()).toEqual({ a: 10, b: 0.5 });
  });
});
