import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notifyPatchScrapeFailure } from '../../src/scraper/patchScrapeAlerts.js';
import { PatchPreflightError } from '../../src/scraper/patchPreflight.js';

const sendAlert = vi.fn().mockResolvedValue({ isOk: () => true, unwrap: () => undefined });

vi.mock('../../src/services/DiscordService.js', () => ({
  DiscordService: class MockDiscordService {
    sendAlert = sendAlert;
  },
}));

describe('patchScrapeAlerts', () => {
  beforeEach(() => {
    sendAlert.mockClear();
  });

  it('should alert with 404 title for url_not_found', async () => {
    const error = new PatchPreflightError(
      'Page patch notes introuvable (HTTP 404)',
      'url_not_found',
      'https://example.com/patch',
      404
    );

    await notifyPatchScrapeFailure(error, {
      patchVersion: '16.11',
      url: 'https://example.com/patch',
      triggeredBy: 'test',
    });

    expect(sendAlert).toHaveBeenCalledOnce();
    expect(sendAlert.mock.calls[0][0]).toContain('404');
    expect(sendAlert.mock.calls[0][2]).toBe(error);
    expect(sendAlert.mock.calls[0][3]).toMatchObject({
      patchVersion: '16.11',
      reason: 'url_not_found',
      httpStatus: 404,
    });
  });

  it('should alert with generic title for scrape errors', async () => {
    await notifyPatchScrapeFailure(new Error('Parse failed'), {
      patchVersion: '16.10',
      triggeredBy: 'dataDragonSync',
    });

    expect(sendAlert).toHaveBeenCalledOnce();
    expect(sendAlert.mock.calls[0][0]).toContain('échec du scraping');
  });
});
