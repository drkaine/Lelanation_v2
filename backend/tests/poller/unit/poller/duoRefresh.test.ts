import { beforeEach, describe, expect, it, vi } from 'vitest';

const txMock = vi.fn();
const beginMock = vi.fn();

vi.mock('../../../../src/db/client.js', () => ({
  sql: {
    begin: (fn: (tx: unknown) => unknown) => {
      beginMock();
      const tx = (strings: TemplateStringsArray, ...values: unknown[]) => txMock(strings.join('?'), values);
      return fn(tx);
    },
  },
}));

const scheduleMock = vi.fn();
vi.mock('node-cron', () => ({ default: { schedule: scheduleMock } }));

const logInfo = vi.fn();
const logError = vi.fn();
vi.mock('../../../../src/utils/cronLogger.js', () => ({
  createCronLogger: () => ({ info: logInfo, error: logError }),
}));

describe('refreshPlayerDuos', () => {
  beforeEach(() => {
    txMock.mockReset();
    beginMock.mockReset();
    logInfo.mockReset();
    logError.mockReset();
    scheduleMock.mockReset();
  });

  it('incrémental : ne part que des matchs ingérés depuis le dernier passage, puis avance le curseur', async () => {
    const since = new Date('2026-11-23T03:15:00Z');
    const until = new Date('2026-11-24T03:15:00Z');
    txMock
      .mockResolvedValueOnce([{ since, until }])
      .mockResolvedValueOnce([
        { puuid_a: 'a', puuid_b: 'b' },
        { puuid_a: 'c', puuid_b: 'd' },
      ])
      .mockResolvedValueOnce([{ riot_match_id: 'EUW1_1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ puuid_a: 'z' }])
      .mockResolvedValueOnce([]);
    const { refreshPlayerDuos } = await import('../../../../src/poll-orchestration/DuoRefresh.js');
    const result = await refreshPlayerDuos();

    expect(beginMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ pairs: 2, gamesInserted: 1, pairsDeleted: 1 });
    const texts = txMock.mock.calls.map((c) => String(c[0]));
    const values = txMock.mock.calls.map((c) => c[1] as unknown[]);
    expect(texts[0]).toContain('duo_refresh_state');
    expect(texts[1]).toContain('INSERT INTO player_duos');
    expect(texts[1]).toContain('created_at >');
    expect(texts[1]).toContain('early_surrender IS NOT TRUE');
    // part décimale (0.1) : typée float8, sinon Postgres l'infère integer depuis ga.n
    expect(texts[1]).toContain('?::float8 * ga.n');
    expect(values[1]).toContain(since);
    expect(values[1]).toContain(until);
    expect(values[1]).toContainEqual(['EUW1', 'KR']);
    expect(texts[2]).toContain('player_duo_games');
    expect(texts[2]).toContain('<= m.game_date');
    expect(values[2]).toContainEqual(['a', 'c']);
    expect(values[2]).toContainEqual(['b', 'd']);
    expect(texts[3]).toContain('UPDATE player_duos');
    expect(values[3]).toContainEqual(['a', 'c']);
    expect(texts[4]).toContain('DELETE FROM player_duos');
    expect(texts[5]).toContain('duo_refresh_state');
    expect(values[5]).toContain(until);
  });

  it('rien de neuf depuis le dernier passage : pas de self-join, seulement la purge', async () => {
    const at = new Date('2026-11-24T03:15:00Z');
    txMock.mockResolvedValueOnce([{ since: at, until: at }]).mockResolvedValueOnce([]);
    const { refreshPlayerDuos } = await import('../../../../src/poll-orchestration/DuoRefresh.js');
    const result = await refreshPlayerDuos();
    expect(result).toEqual({ pairs: 0, gamesInserted: 0, pairsDeleted: 0 });
    const texts = txMock.mock.calls.map((c) => String(c[0]));
    expect(texts).toHaveLength(2);
    expect(texts[1]).toContain('DELETE FROM player_duos');
  });

  it('le cron journalise le résultat, ou l’erreur sans planter', async () => {
    txMock.mockResolvedValueOnce([{ since: null, until: null }]).mockResolvedValueOnce([]);
    const { runDuoRefreshOnce, setupDuoRefresh } = await import('../../../../src/cron/duoRefresh.js');
    await runDuoRefreshOnce();
    expect(logInfo).toHaveBeenCalledWith('Duo refresh done', { pairs: 0, gamesInserted: 0, pairsDeleted: 0 });

    txMock.mockRejectedValueOnce(new Error('boom'));
    await runDuoRefreshOnce();
    expect(logError).toHaveBeenCalledWith('Duo refresh failed', { error: 'Error: boom' });

    setupDuoRefresh();
    expect(scheduleMock).toHaveBeenCalledWith('15 3 * * *', expect.any(Function), { timezone: 'Etc/UTC' });
  });
});
