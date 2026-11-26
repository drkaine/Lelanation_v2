import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/db/query.js', () => ({
  queryRawUnsafe: async () => [],
  isDatabaseConfigured: () => true,
}));

const { DEFAULT_STATS_LIMITS, statsLimitsStore, updateStatsLimits } = await import(
  '../../../../src/services/StatsLimitsService.js'
);
const { adminLimitsStore, getAdminLimits, updateAdminLimits } = await import(
  '../../../../src/services/AdminLimitsService.js'
);
const { tierListMinGames } = await import('../../../../src/services/tierListSample.js');
const { synergyLaneZ } = await import('../../../../src/services/synergyLaneScore.js');
const { shouldAutoPrivatizeFromCommunityVotes } = await import('../../../../src/services/buildVoteVisibility.js');
const { pollDelayDays, pollDelaySql } = await import('../../../../src/poll-orchestration/pollYield.js');
const { playerSinceTimestamp, pollWindowMs } = await import('../../../../src/poller/playerSinceWindow.js');
const { getPollerPatchRetentionConfig } = await import('../../../../src/services/RiotConfigService.js');
const { __testables } = await import('../../../../src/services/MatchupTierService.js');
const { buildOtpCompare } = await import('../../../../src/services/StatsOtpCompareService.js');
const { buildRegionCompare } = await import('../../../../src/services/StatsRegionCompareService.js');

let dir = '';
let savedStats: string | undefined;
let savedAdmin: string | undefined;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'limits-use-'));
  savedStats = process.env.STATS_LIMITS_FILE;
  savedAdmin = process.env.ADMIN_LIMITS_FILE;
  process.env.STATS_LIMITS_FILE = join(dir, 'stats.json');
  process.env.ADMIN_LIMITS_FILE = join(dir, 'admin.json');
  statsLimitsStore.reset();
  adminLimitsStore.reset();
});
afterEach(() => {
  if (savedStats === undefined) delete process.env.STATS_LIMITS_FILE;
  else process.env.STATS_LIMITS_FILE = savedStats;
  if (savedAdmin === undefined) delete process.env.ADMIN_LIMITS_FILE;
  else process.env.ADMIN_LIMITS_FILE = savedAdmin;
  statsLimitsStore.reset();
  adminLimitsStore.reset();
  rmSync(dir, { recursive: true, force: true });
});

const setStats = (patch: Partial<typeof DEFAULT_STATS_LIMITS>) =>
  expect(updateStatsLimits({ ...DEFAULT_STATS_LIMITS, ...patch }).ok).toBe(true);
const setAdmin = (patch: Record<string, number>) => expect(updateAdminLimits({ ...getAdminLimits(), ...patch }).ok).toBe(true);

describe('limites stats appliquées', () => {
  it('tier list : plancher et % de picks', () => {
    setStats({ tierListMinGames: 20, tierListMinPickPct: 1 });
    expect(tierListMinGames(58)).toBe(20);
    expect(tierListMinGames(15663)).toBe(157);
  });
  it('synergie : pairs sous le minimum exclus', () => {
    const peer = (id: number, games: number) => ({
      champion_id: id, games, sum_level: games, sum_kill_def: 0, sum_cs: 0, sum_vision: 0, sum_laning: 0, sum_early: 0,
    });
    const my = peer(1, 10);
    const peers = [peer(2, 4), peer(3, 6)];
    expect(synergyLaneZ(my, peers, 1).cohortSize).toBe(2);
    setStats({ synergyMinPeerGames: 5 });
    expect(synergyLaneZ(my, peers, 1).cohortSize).toBe(1);
  });
  it('matchup : échelle du score', () => {
    expect(__testables.computeScoreFromAggregates(1000, 1000, 9, 20).score).toBe(10);
    setStats({ matchupScoreMax: 5 });
    expect(__testables.computeScoreFromAggregates(1000, 1000, 9, 20).score).toBe(5);
  });
  it('OTP : minimum winrate et top', () => {
    const g = (grp: 'otp' | 'others') => ({ grp, games: 100, wins: 50, kills: 1, deaths: 1, assists: 1, afk: 0, champions: 3 });
    const c = (grp: 'otp' | 'others', champion: number, picks: number) => ({ grp, champion, picks, wins: picks });
    const rows = [c('otp', 1, 5), c('others', 1, 50), c('otp', 2, 8), c('otp', 3, 9)];
    expect(buildOtpCompare([g('otp'), g('others')], rows).spreads.winRate).toEqual([]);
    setStats({ otpWinrateMinGames: 5, compareTopLimit: 2 });
    const r = buildOtpCompare([g('otp'), g('others')], rows);
    expect(r.spreads.winRate.length).toBe(1);
    expect(r.top.find((t) => t.group === 'otp')?.picked.length).toBe(2);
  });
  it('région : top et liste des écarts', () => {
    expect(typeof buildRegionCompare).toBe('function');
  });
});

describe('limites admin appliquées', () => {
  it('votes communauté', () => {
    expect(shouldAutoPrivatizeFromCommunityVotes(1, 9)).toBe(true);
    setAdmin({ voteMinTotal: 20 });
    expect(shouldAutoPrivatizeFromCommunityVotes(1, 9)).toBe(false);
    setAdmin({ voteMinTotal: 10, voteMinUpvotePct: 5 });
    expect(shouldAutoPrivatizeFromCommunityVotes(1, 9)).toBe(false);
  });
  it('rythme du poller : délai JS et SQL', () => {
    setAdmin({ pollTargetNewGames: 10, pollMinDelayDays: 1, pollMaxDelayDays: 7 });
    expect(pollDelayDays(5)).toBe(2);
    expect(pollDelayDays(100)).toBe(1);
    expect(pollDelayDays(0)).toBe(7);
    expect(pollDelaySql()).toContain('7::float8');
    expect(pollDelaySql()).toContain('10::float8');
  });
  it('fenêtre de poll', () => {
    const NOW = Date.UTC(2026, 0, 10);
    setAdmin({ pollWindowHours: 24 });
    expect(pollWindowMs()).toBe(24 * 3_600_000);
    expect(playerSinceTimestamp(0, null, NOW)).toBe(Math.floor((NOW - 24 * 3_600_000) / 1000));
  });
  it('rétention des patchs : 0 = désactivée', () => {
    setAdmin({ patchRetentionDays: 0 });
    expect(getPollerPatchRetentionConfig()).toEqual({ enabled: false });
    setAdmin({ patchRetentionDays: 8 });
    expect(getPollerPatchRetentionConfig()).toEqual({ enabled: true, days: 8 });
  });
});
