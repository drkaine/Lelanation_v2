import { describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  Pool: class {
    request(): Promise<never> {
      const err = new Error('read ECONNRESET') as NodeJS.ErrnoException;
      err.code = 'ECONNRESET';
      return Promise.reject(err);
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

const { riotFetch } = await import('../../../src/riot-gateway/http/undiciClient.js');
const { gatewayLogger } = await import('../../../src/riot-gateway/logger.js');
const { RiotNetworkError } = await import('../../../src/riot-gateway/types.js');

describe('riotFetch network errors', () => {
  it('logs a retried network error as warn, not error', async () => {
    const warn = vi.spyOn(gatewayLogger, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(gatewayLogger, 'error').mockImplementation(() => undefined);

    await expect(riotFetch('https://europe.api.riotgames.com', '/x')).rejects.toBeInstanceOf(RiotNetworkError);

    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'network_error', errorCode: 'ECONNRESET' }),
      'Network error calling Riot API',
    );
  });
});
