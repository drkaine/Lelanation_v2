import { describe, expect, it, vi } from 'vitest';
import {
  purgeMatches,
  purgePollTargets,
  purgeRankHistory,
  rankHistoryCutoffDate,
  retentionDays,
} from '../../../../src/poll-orchestration/rankHistoryRetention.js';

describe('rankHistoryRetention', () => {
  it('garde 15 jours, aujourd’hui compris', () => {
    expect(rankHistoryCutoffDate('2026-11-24', 15)).toBe('2026-11-10');
    expect(rankHistoryCutoffDate('2026-11-24', 14)).toBe('2026-11-11');
    expect(rankHistoryCutoffDate('2026-03-05', 14)).toBe('2026-02-20');
    expect(rankHistoryCutoffDate('2026-11-24', 1)).toBe('2026-11-24');
  });

  it('jours de rétention : env valide sinon 15', () => {
    expect(retentionDays(undefined)).toBe(15);
    expect(retentionDays('7')).toBe(7);
    expect(retentionDays('0')).toBe(15);
    expect(retentionDays('abc')).toBe(15);
  });

  it('matchs (participants et teams en cascade) : supprimés par lots jusqu’au dernier lot incomplet', async () => {
    const counts = [1000, 1000, 12];
    const deleteBatch = vi.fn(async () => counts.shift() ?? 0);
    const deleted = await purgeMatches({ today: () => '2026-11-24', deleteBatch }, 15, 1000);
    expect(deleteBatch).toHaveBeenCalledTimes(3);
    expect(deleteBatch).toHaveBeenCalledWith('2026-11-10', 1000);
    expect(deleted).toBe(2012);
  });

  it('purge les lignes plus vieilles que la date limite', async () => {
    const deleteBefore = vi.fn(async () => 42);
    const deleted = await purgeRankHistory({ today: () => '2026-11-24', deleteBefore }, 14);
    expect(deleteBefore).toHaveBeenCalledWith('2026-11-11');
    expect(deleted).toBe(42);
  });

  it('cibles de poll : seul le jour du balayage est gardé', async () => {
    const deleteBefore = vi.fn(async () => 7);
    expect(await purgePollTargets({ today: () => '2026-11-24', deleteBefore })).toBe(7);
    expect(deleteBefore).toHaveBeenCalledWith('2026-11-24');
  });
});
