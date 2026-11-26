import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_STATS_LIMITS,
  getStatsLimits,
  statsLimitsStore,
  updateStatsLimits,
} from '../../../../src/services/StatsLimitsService.js';
import { adminLimitsStore, getAdminLimits, updateAdminLimits } from '../../../../src/services/AdminLimitsService.js';

let dir = '';
const ENV_KEYS = ['STATS_LIMITS_FILE', 'ADMIN_LIMITS_FILE', 'DATA_RETENTION_DAYS', 'RANK_HISTORY_RETENTION_DAYS', 'POLLER_PATCH_RETENTION_DAYS'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'limits-svc-'));
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.STATS_LIMITS_FILE = join(dir, 'stats.json');
  process.env.ADMIN_LIMITS_FILE = join(dir, 'admin.json');
  statsLimitsStore.reset();
  adminLimitsStore.reset();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  rmSync(dir, { recursive: true, force: true });
});

describe('limites stats (Gestion)', () => {
  it('défauts = valeurs historiques', () => {
    expect(getStatsLimits()).toEqual(DEFAULT_STATS_LIMITS);
    expect(DEFAULT_STATS_LIMITS).toEqual({
      tierListMinGames: 10,
      tierListMinPickPct: 0.5,
      botlaneMinGames: 10,
      regionWinrateMinGames: 20,
      otpWinrateMinGames: 10,
      compareTopLimit: 10,
      regionSpreadLimit: 15,
      dashboardPopulationMinGames: 30,
      synergyMinPeerGames: 3,
      matchupScoreMax: 10,
    });
  });
  it('mise à jour valide appliquée, invalide refusée', () => {
    const next = { ...DEFAULT_STATS_LIMITS, tierListMinGames: 25, compareTopLimit: 20 };
    expect(updateStatsLimits(next)).toEqual({ ok: true, settings: next });
    expect(getStatsLimits().tierListMinGames).toBe(25);
    expect(updateStatsLimits({ ...next, compareTopLimit: 0 }).ok).toBe(false);
    expect(updateStatsLimits({ ...next, tierListMinPickPct: 101 }).ok).toBe(false);
    expect(updateStatsLimits({ ...next, matchupScoreMax: 0 }).ok).toBe(false);
  });
});

describe('limites admin', () => {
  it('défauts, rétentions lues dans l’env', () => {
    expect(getAdminLimits()).toEqual({
      voteMinTotal: 10,
      voteMinUpvotePct: 30,
      pollTargetNewGames: 5,
      pollMinDelayDays: 0.25,
      pollMaxDelayDays: 30,
      pollWindowHours: 48,
      rankHistoryRetentionDays: 15,
      patchRetentionDays: 0,
    });
    process.env.DATA_RETENTION_DAYS = '20';
    process.env.POLLER_PATCH_RETENTION_DAYS = '7';
    expect(getAdminLimits()).toMatchObject({ rankHistoryRetentionDays: 20, patchRetentionDays: 7 });
    process.env.POLLER_PATCH_RETENTION_DAYS = 'true';
    expect(getAdminLimits().patchRetentionDays).toBe(5);
  });
  it('délai max ≥ délai min, sinon refus', () => {
    const base = getAdminLimits();
    expect(updateAdminLimits({ ...base, pollMinDelayDays: 2, pollMaxDelayDays: 1 }).ok).toBe(false);
    expect(updateAdminLimits({ ...base, pollMinDelayDays: 1, pollMaxDelayDays: 2 }).ok).toBe(true);
    expect(getAdminLimits().pollMinDelayDays).toBe(1);
  });
  it('fichier écrit par un autre process relu', () => {
    writeFileSync(join(dir, 'admin.json'), JSON.stringify({ ...getAdminLimits(), voteMinTotal: 42 }));
    adminLimitsStore.reset();
    expect(getAdminLimits().voteMinTotal).toBe(42);
  });
});
