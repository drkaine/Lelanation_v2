/**
 * Discord alerts for patch notes scrape / preflight failures.
 */

import { DiscordService } from '../services/DiscordService.js';
import { PatchPreflightError, type PatchPreflightFailureReason } from './patchPreflight.js';

function alertTitle(reason?: PatchPreflightFailureReason, status?: number): string {
  if (reason === 'url_not_found' || status === 404) {
    return '🚨 Patch notes — page 404';
  }
  if (reason === 'http_error') {
    return '🚨 Patch notes — erreur HTTP';
  }
  if (reason === 'empty_content') {
    return '🚨 Patch notes — contenu illisible';
  }
  if (reason === 'fetch_failed') {
    return '🚨 Patch notes — accès impossible';
  }
  return '🚨 Patch notes — échec du scraping';
}

function resolveFailure(error: unknown): {
  reason?: PatchPreflightFailureReason;
  status?: number;
  message: string;
} {
  if (error instanceof PatchPreflightError) {
    return { reason: error.reason, status: error.status, message: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);
  const statusMatch = message.match(/HTTP (\d{3})/i);
  const status = statusMatch ? Number.parseInt(statusMatch[1], 10) : undefined;

  if (status === 404) {
    return { reason: 'url_not_found', status, message };
  }
  if (status && status >= 400) {
    return { reason: 'http_error', status, message };
  }

  return { message };
}

export type PatchScrapeAlertContext = {
  patchVersion?: string;
  url?: string;
  triggeredBy?: string;
  locale?: string;
};

/**
 * Send Discord alert for patch scrape or preflight failure.
 * Never throws — logging only on Discord failure.
 */
export async function notifyPatchScrapeFailure(
  error: unknown,
  context: PatchScrapeAlertContext = {}
): Promise<void> {
  const { reason, status, message } = resolveFailure(error);
  const discord = new DiscordService();

  await discord.sendAlert(
    alertTitle(reason, status),
    message,
    error,
    {
      ...(context.patchVersion ? { patchVersion: context.patchVersion } : {}),
      ...(context.url ? { url: context.url } : {}),
      ...(context.triggeredBy ? { triggeredBy: context.triggeredBy } : {}),
      ...(context.locale ? { locale: context.locale } : {}),
      ...(reason ? { reason } : {}),
      ...(status ? { httpStatus: status } : {}),
    }
  );
}
