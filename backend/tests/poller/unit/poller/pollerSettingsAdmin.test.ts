import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyPendingPollerSettings,
  pendingSettingsFile,
  pollerSettingsView,
  updatePollerSettings,
} from '../../../../src/services/PollerSettingsAdminService.js';

const file = () => join(mkdtempSync(join(tmpdir(), 'psa-')), 'p.json');

describe('pollerSettingsView', () => {
  it('réglages actifs + aucun en attente + plateformes proposées avec cluster', () => {
    const v = pollerSettingsView(file(), ['euw1']);
    expect(v.settings.platforms).toEqual(['euw1']);
    expect(v.pending).toBeNull();
    expect(v.choices.find((c) => c.platform === 'kr')?.cluster).toBe('asia');
    expect(v.tiers[0]).toBe('CHALLENGER');
  });
});

describe('updatePollerSettings : en attente jusqu’à 00 h', () => {
  it('valide : écrit le fichier en attente, l’actif ne bouge pas', () => {
    const f = file();
    const r = updatePollerSettings(f, { platforms: ['kr'], tierWeights: { GOLD: 100 } });
    expect(r.ok).toBe(true);
    const v = pollerSettingsView(f, ['euw1']);
    expect(v.settings.platforms).toEqual(['euw1']);
    expect(v.pending?.platforms).toEqual(['kr']);
    expect(pendingSettingsFile(f)).toBe(f.replace(/\.json$/, '.pending.json'));
  });
  it('poids par région : conservés dans les réglages en attente', () => {
    const f = file();
    const r = updatePollerSettings(f, {
      platforms: ['euw1', 'kr'],
      tierWeights: { GOLD: 100 },
      tierWeightsByRegion: { asia: { IRON: 100 } },
    });
    expect(r.ok).toBe(true);
    expect(pollerSettingsView(f, ['euw1']).pending?.tierWeightsByRegion?.asia?.IRON).toBe(100);
  });
  it('invalide : refusé, rien écrit', () => {
    const f = file();
    expect(updatePollerSettings(f, { platforms: ['kr'], tierWeights: { GOLD: 101 } }).ok).toBe(false);
    expect(pollerSettingsView(f, ['euw1']).pending).toBeNull();
  });
});

describe('applyPendingPollerSettings (cron 00 h)', () => {
  it('en attente : devient actif, fichier en attente supprimé, poller redémarré', () => {
    const f = file();
    updatePollerSettings(f, { platforms: ['kr'], tierWeights: { GOLD: 100 } });
    const restart = vi.fn();
    expect(applyPendingPollerSettings(f, restart)).toBe(true);
    const v = pollerSettingsView(f, ['euw1']);
    expect(v.settings.platforms).toEqual(['kr']);
    expect(v.pending).toBeNull();
    expect(existsSync(pendingSettingsFile(f))).toBe(false);
    expect(restart).toHaveBeenCalledTimes(1);
  });
  it('rien en attente : ni écriture ni redémarrage', () => {
    const restart = vi.fn();
    expect(applyPendingPollerSettings(file(), restart)).toBe(false);
    expect(restart).not.toHaveBeenCalled();
  });
});
