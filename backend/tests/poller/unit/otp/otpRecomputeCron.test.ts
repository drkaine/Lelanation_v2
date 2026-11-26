import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../src/db/client.js', () => ({ sql: {} }));
vi.mock('../../../../src/services/reaggregateAll.js', () => ({ reaggregateAllMatches: vi.fn() }));
vi.mock('../../../../src/utils/cronLogger.js', () => ({ createCronLogger: vi.fn() }));
vi.mock('../../../../src/services/OtpFlagService.js', () => ({ recomputeOtpFlags: vi.fn() }));
import { runOtpRecomputeOnce, type OtpRecomputeDeps } from '../../../../src/cron/otpRecompute.js';

const deps = (over: Partial<OtpRecomputeDeps> = {}): OtpRecomputeDeps => {
  const prints = ['a', 'b'];
  return {
    loadSettings: () => ({ thresholdPct: 70, minGames: 10 }),
    fingerprint: vi.fn(async () => prints.shift() ?? 'z'),
    recompute: vi.fn(async () => 3),
    reaggregate: vi.fn(async () => 42),
    log: { info: vi.fn(async () => undefined), error: vi.fn(async () => undefined) },
    ...over,
  };
};

describe('runOtpRecomputeOnce (cron nocturne)', () => {
  it('flags changés : recalcul avec les réglages puis réagrégation', async () => {
    const d = deps();
    expect(await runOtpRecomputeOnce(d)).toEqual({ otpPlayers: 3, reaggregated: 42 });
    expect(d.recompute).toHaveBeenCalledWith({ thresholdPct: 70, minGames: 10 });
    expect(d.reaggregate).toHaveBeenCalledOnce();
  });
  it('flags identiques : pas de réagrégation (évite de vider les stats pour rien)', async () => {
    const d = deps({ fingerprint: vi.fn(async () => 'same') });
    expect(await runOtpRecomputeOnce(d)).toEqual({ otpPlayers: 3, reaggregated: 0 });
    expect(d.reaggregate).not.toHaveBeenCalled();
  });
  it('erreur : loggée, pas levée', async () => {
    const d = deps({ recompute: vi.fn(async () => Promise.reject(new Error('boom'))) });
    expect(await runOtpRecomputeOnce(d)).toBeNull();
    expect(d.log.error).toHaveBeenCalled();
    expect(d.reaggregate).not.toHaveBeenCalled();
  });
});
