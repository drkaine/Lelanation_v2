import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TIER_DISTRIBUTION,
  getTierDistribution,
  loadTierDistribution,
  parseTierDistribution,
  resetTierDistributionCache,
  updateTierDistribution,
} from '../../../../src/services/TierDistributionService.js';
import { assignTiersFromNotes } from '../../../../src/services/tierListAssign.js';

const file = () => join(mkdtempSync(join(tmpdir(), 'tierdist-')), 'tier.json');
const custom = { bHalf: 10, sMin: 20, sPlusMin: 30, extremeGap: 0, extremeMax: 2 };

afterEach(() => {
  delete process.env.TIER_DISTRIBUTION_FILE;
  resetTierDistributionCache();
});

describe('parseTierDistribution', () => {
  it('défauts = anciennes constantes (B ±35, S 70, S+ 105, écart 30, max 5)', () => {
    expect(DEFAULT_TIER_DISTRIBUTION).toEqual({ bHalf: 35, sMin: 70, sPlusMin: 105, extremeGap: 30, extremeMax: 5 });
  });
  it('valide : 0 < B < S ≤ S+, écart ≥ 0, max entier ≥ 0', () => {
    expect(parseTierDistribution(custom)).toEqual(custom);
  });
  it('invalide : ordre des seuils, négatifs, non entier, absent', () => {
    expect(parseTierDistribution({ ...custom, bHalf: 0 })).toBeNull();
    expect(parseTierDistribution({ ...custom, sMin: 10 })).toBeNull();
    expect(parseTierDistribution({ ...custom, sPlusMin: 19 })).toBeNull();
    expect(parseTierDistribution({ ...custom, extremeGap: -1 })).toBeNull();
    expect(parseTierDistribution({ ...custom, extremeMax: 1.5 })).toBeNull();
    expect(parseTierDistribution({ ...custom, bHalf: '10' })).toBeNull();
    expect(parseTierDistribution(null)).toBeNull();
  });
});

describe('load / update / cache', () => {
  it('fichier absent ou invalide : défauts', () => {
    expect(loadTierDistribution(file())).toEqual(DEFAULT_TIER_DISTRIBUTION);
    const f = file();
    writeFileSync(f, '{"bHalf":-1}');
    expect(loadTierDistribution(f)).toEqual(DEFAULT_TIER_DISTRIBUTION);
  });
  it('update valide : écrit, relu, et appliqué tout de suite', () => {
    const f = file();
    process.env.TIER_DISTRIBUTION_FILE = f;
    expect(getTierDistribution()).toEqual(DEFAULT_TIER_DISTRIBUTION);
    expect(updateTierDistribution(f, custom)).toEqual({ ok: true, settings: custom });
    expect(loadTierDistribution(f)).toEqual(custom);
    expect(getTierDistribution()).toEqual(custom);
  });
  it('update invalide : refusé, rien écrit', () => {
    const f = file();
    expect(updateTierDistribution(f, { bHalf: 'x' })).toEqual({ ok: false });
    expect(loadTierDistribution(f)).toEqual(DEFAULT_TIER_DISTRIBUTION);
  });
});

describe('assignTiersFromNotes suit la répartition', () => {
  const notes = [1.2, 0.8, 0.5, 0.1, -0.1, -0.5, -1.2];
  it('défauts : même résultat que les anciennes constantes', () => {
    expect(assignTiersFromNotes(notes)).toEqual(['S+', 'S', 'A', 'B', 'B', 'C', 'D']);
  });
  it('réglage personnalisé : bandes et plafond S+/D', () => {
    expect(assignTiersFromNotes(notes, custom)).toEqual(['S+', 'S+', 'S', 'A', 'C', 'D', 'D']);
    expect(assignTiersFromNotes(notes, { ...custom, extremeMax: 1 })).toEqual(['S+', 'S', 'S', 'A', 'C', 'C', 'D']);
  });
});
