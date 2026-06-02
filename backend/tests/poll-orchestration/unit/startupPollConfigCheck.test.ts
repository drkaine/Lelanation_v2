import { describe, expect, test, vi } from 'vitest';
import { assertPollConfigFiltersWired } from '../../../src/poll-orchestration/startupPollConfigCheck.js';
import type { PollConfig } from '../../../src/poller/types.js';

describe('startupPollConfigCheck', () => {
  test('logs startup check when filters are wired', () => {
    const info = vi.fn();
    const error = vi.fn();
    const exitFn = vi.fn(() => {
      throw new Error('exit should not be called');
    });

    const pollConfig: Partial<PollConfig> = {
      resolveParticipantRanks: false,
      matchFilter: async (ids: string[]) => ids,
      rankFilter: async () => false,
    };
    assertPollConfigFiltersWired(pollConfig, { info, error }, exitFn as never);

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ matchFilterWired: true, rankFilterWired: true }),
      expect.any(String),
    );
    expect(error).not.toHaveBeenCalled();
  });

  test('exits with code 1 when matchFilter is missing', () => {
    const info = vi.fn();
    const error = vi.fn();
    const exitFn = vi.fn((code: number) => {
      throw new Error(`exit:${code}`);
    });

    const pollConfig: Partial<PollConfig> = {
      resolveParticipantRanks: false,
      rankFilter: async () => false,
    };

    expect(() => assertPollConfigFiltersWired(pollConfig, { info, error }, exitFn as never)).toThrow('exit:1');
    expect(exitFn).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalled();
  });
});
