import { describe, expect, it } from 'vitest';
import {
  currentStatsOtp,
  otpParam,
  otpSqlCondition,
  regionCacheKey,
  runWithStatsRegion,
} from '../../../../src/stats/statsRegion.js';

describe('otpParam (?otp=)', () => {
  it('all par défaut ; exclude / only reconnus ; le reste = all', () => {
    expect(otpParam(undefined)).toBe('all');
    expect(otpParam('only')).toBe('only');
    expect(otpParam('EXCLUDE')).toBe('exclude');
    expect(otpParam('non')).toBe('all');
    expect(otpParam(['only'])).toBe('only');
  });
});

describe('contexte OTP de la requête stats', () => {
  it('hors requête : all, pas de condition, clé de cache inchangée', () => {
    expect(currentStatsOtp()).toBe('all');
    expect(otpSqlCondition('cs')).toBeNull();
    expect(regionCacheKey()).toBe('');
  });
  it('only / exclude : condition sur la colonne otp et clé de cache distincte', () => {
    runWithStatsRegion(null, () => {
      expect(otpSqlCondition('cs')).toBe('cs.otp = true');
      expect(otpSqlCondition('')).toBe('otp = true');
      expect(regionCacheKey()).toBe('otp=only:');
    }, 'only');
    runWithStatsRegion(['KR'], () => {
      expect(otpSqlCondition('t')).toBe('t.otp = false');
      expect(regionCacheKey()).toBe('r=KR:otp=exclude:');
    }, 'exclude');
  });
  it('all : aucune condition (total = somme des lignes OTP et non OTP)', () => {
    runWithStatsRegion(['KR'], () => {
      expect(otpSqlCondition('cs')).toBeNull();
      expect(regionCacheKey()).toBe('r=KR:');
    }, 'all');
  });
});
