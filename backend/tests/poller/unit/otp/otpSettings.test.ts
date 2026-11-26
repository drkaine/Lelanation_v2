import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OTP_SETTINGS,
  loadOtpSettings,
  parseOtpSettings,
  updateOtpSettings,
} from '../../../../src/services/OtpSettingsService.js';

const file = () => join(mkdtempSync(join(tmpdir(), 'otp-')), 'otp.json');

describe('parseOtpSettings', () => {
  it('valide : seuil 1-100 %, min games entier ≥ 1', () => {
    expect(parseOtpSettings({ thresholdPct: 80, minGames: 20 })).toEqual({ thresholdPct: 80, minGames: 20 });
  });
  it('invalide : hors bornes, non entier ou absent', () => {
    expect(parseOtpSettings({ thresholdPct: 0, minGames: 10 })).toBeNull();
    expect(parseOtpSettings({ thresholdPct: 101, minGames: 10 })).toBeNull();
    expect(parseOtpSettings({ thresholdPct: 70, minGames: 0 })).toBeNull();
    expect(parseOtpSettings({ thresholdPct: 70, minGames: 2.5 })).toBeNull();
    expect(parseOtpSettings({ thresholdPct: '70', minGames: 10 })).toBeNull();
    expect(parseOtpSettings(null)).toBeNull();
  });
});

describe('loadOtpSettings / updateOtpSettings', () => {
  it('fichier absent ou invalide : 70 % et 10 games par défaut', () => {
    expect(DEFAULT_OTP_SETTINGS).toEqual({ thresholdPct: 70, minGames: 10 });
    expect(loadOtpSettings(file())).toEqual(DEFAULT_OTP_SETTINGS);
    const f = file();
    writeFileSync(f, '{oops');
    expect(loadOtpSettings(f)).toEqual(DEFAULT_OTP_SETTINGS);
  });
  it('valide : enregistré puis relu', () => {
    const f = file();
    expect(updateOtpSettings(f, { thresholdPct: 60, minGames: 15 }).ok).toBe(true);
    expect(loadOtpSettings(f)).toEqual({ thresholdPct: 60, minGames: 15 });
  });
  it('invalide : refusé, rien écrit', () => {
    const f = file();
    expect(updateOtpSettings(f, { thresholdPct: 200, minGames: 15 }).ok).toBe(false);
    expect(loadOtpSettings(f)).toEqual(DEFAULT_OTP_SETTINGS);
  });
});
