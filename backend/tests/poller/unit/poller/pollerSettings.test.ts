import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  defaultTierWeights,
  loadPollerSettings,
  parsePollerSettings,
  platformChoices,
  POLL_TIERS,
  savePollerSettings,
  tierWeightsFor,
} from '../../../../src/poller/pollerSettings.js';

const weights = (over: Partial<Record<string, number>>) => ({
  ...Object.fromEntries(POLL_TIERS.map((t) => [t, 0])),
  ...over,
});

describe('parsePollerSettings', () => {
  it('valide : plateformes connues dédoublonnées, poids par tier', () => {
    expect(
      parsePollerSettings({ platforms: ['euw1', 'kr', 'euw1'], tierWeights: weights({ GOLD: 60, IRON: 40 }) }),
    ).toEqual({ platforms: ['euw1', 'kr'], tierWeights: weights({ GOLD: 60, IRON: 40 }) });
  });
  it('tier absent = 0', () => {
    expect(parsePollerSettings({ platforms: ['kr'], tierWeights: { GOLD: 100 } })?.tierWeights).toEqual(
      weights({ GOLD: 100 }),
    );
  });
  it.each([
    ['plateforme inconnue', { platforms: ['xx1'], tierWeights: { GOLD: 10 } }],
    ['aucune plateforme', { platforms: [], tierWeights: { GOLD: 10 } }],
    ['total > 100', { platforms: ['kr'], tierWeights: { GOLD: 60, IRON: 41 } }],
    ['total nul', { platforms: ['kr'], tierWeights: {} }],
    ['poids négatif', { platforms: ['kr'], tierWeights: { GOLD: -1, IRON: 50 } }],
    ['tier inconnu', { platforms: ['kr'], tierWeights: { WOOD: 10 } }],
    ['pas un objet', 'x'],
  ])('refuse : %s', (_label, raw) => {
    expect(parsePollerSettings(raw)).toBeNull();
  });
});

describe('poids par région de rate limit (europe, americas, asia, sea)', () => {
  it('optionnels : valides pour les clusters des plateformes choisies, tier absent = 0', () => {
    const s = parsePollerSettings({
      platforms: ['euw1', 'kr'],
      tierWeights: { GOLD: 100 },
      tierWeightsByRegion: { asia: { CHALLENGER: 50, IRON: 50 } },
    });
    expect(s?.tierWeightsByRegion).toEqual({ asia: weights({ CHALLENGER: 50, IRON: 50 }) });
  });
  it('absents : pas de clé (mode toutes régions)', () => {
    expect(parsePollerSettings({ platforms: ['kr'], tierWeights: { GOLD: 100 } })).not.toHaveProperty(
      'tierWeightsByRegion',
    );
  });
  it.each([
    ['cluster sans plateforme choisie', { europe: { GOLD: 10 } }],
    ['plateforme au lieu de cluster', { kr: { GOLD: 10 } }],
    ['cluster inconnu', { xx: { GOLD: 10 } }],
    ['total > 100', { asia: { GOLD: 60, IRON: 41 } }],
    ['total nul', { asia: {} }],
    ['pas un objet', 'x'],
  ])('refuse : %s', (_label, byRegion) => {
    expect(
      parsePollerSettings({ platforms: ['kr'], tierWeights: { GOLD: 100 }, tierWeightsByRegion: byRegion }),
    ).toBeNull();
  });
  it('tierWeightsFor : poids du cluster de la plateforme, sinon ceux de toutes les régions', () => {
    const s = parsePollerSettings({
      platforms: ['euw1', 'eun1', 'kr'],
      tierWeights: { GOLD: 100 },
      tierWeightsByRegion: { europe: { IRON: 100 } },
    });
    expect(s && tierWeightsFor(s, 'euw1')).toEqual(weights({ IRON: 100 }));
    expect(s && tierWeightsFor(s, 'eun1')).toEqual(weights({ IRON: 100 }));
    expect(s && tierWeightsFor(s, 'kr')).toEqual(weights({ GOLD: 100 }));
  });
});

describe('defaultTierWeights', () => {
  it('égal par tier, total 100', () => {
    const w = defaultTierWeights();
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(100);
    expect(new Set(Object.values(w)).size).toBe(1);
  });
});

describe('load / save', () => {
  it('fichier absent ou invalide : plateformes de repli, poids par défaut', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ps-'));
    const file = join(dir, 'p.json');
    expect(loadPollerSettings(file, ['euw1'])).toEqual({ platforms: ['euw1'], tierWeights: defaultTierWeights() });
    writeFileSync(file, '{oops');
    expect(loadPollerSettings(file, ['euw1']).platforms).toEqual(['euw1']);
  });
  it('aller-retour', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'ps-')), 'sub', 'p.json');
    const s = { platforms: ['na1' as const], tierWeights: weights({ MASTER: 100 }) };
    savePollerSettings(file, s);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(s);
    expect(loadPollerSettings(file, ['euw1'])).toEqual(s);
  });
});

describe('platformChoices', () => {
  it('chaque plateforme avec son cluster de rate limit match-v5', () => {
    const c = platformChoices();
    expect(c.find((x) => x.platform === 'euw1')?.cluster).toBe('europe');
    expect(c.find((x) => x.platform === 'eun1')?.cluster).toBe('europe');
    expect(c.find((x) => x.platform === 'kr')?.cluster).toBe('asia');
    expect(c.find((x) => x.platform === 'na1')?.cluster).toBe('americas');
    expect(c.find((x) => x.platform === 'vn2')?.cluster).toBe('sea');
  });
});
