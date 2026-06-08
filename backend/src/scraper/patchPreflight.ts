/**
 * Pre-scrape validation: URL reachability + parseable patch content.
 */

import { parsePatchHtml } from './parser.js';
import type { Locale } from './types.js';

const PROBE_TIMEOUT_MS = 15_000;
const MIN_ENTITY_COUNT = 1;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export type PatchPreflightFailureReason =
  | 'url_not_found'
  | 'http_error'
  | 'fetch_failed'
  | 'empty_content';

export class PatchPreflightError extends Error {
  readonly reason: PatchPreflightFailureReason;
  readonly url: string;
  readonly status?: number;

  constructor(
    message: string,
    reason: PatchPreflightFailureReason,
    url: string,
    status?: number
  ) {
    super(message);
    this.name = 'PatchPreflightError';
    this.reason = reason;
    this.url = url;
    this.status = status;
  }
}

export type PatchPreflightSuccess = {
  ok: true;
  url: string;
  status: number;
  entityCount: number;
};

export type PatchPreflightFailure = {
  ok: false;
  url: string;
  reason: PatchPreflightFailureReason;
  status?: number;
  message: string;
};

export type PatchPreflightResult = PatchPreflightSuccess | PatchPreflightFailure;

function mapHttpFailure(status: number, url: string): PatchPreflightFailure {
  if (status === 404) {
    return {
      ok: false,
      url,
      reason: 'url_not_found',
      status,
      message: `Page patch notes introuvable (HTTP 404): ${url}`,
    };
  }

  return {
    ok: false,
    url,
    reason: 'http_error',
    status,
    message: `Erreur HTTP ${status} pour ${url}`,
  };
}

function hasPatchNotesStructure(html: string): boolean {
  return (
    html.includes('patch-notes-container') ||
    /id="patch-[a-z0-9:-]+"/i.test(html) ||
    html.includes('header-primary')
  );
}

/**
 * Validate that HTML contains scrapeable patch notes.
 */
export function validatePatchHtmlContent(html: string, locale: Locale): number {
  if (!html || html.trim().length < 200) {
    throw new PatchPreflightError('HTML vide ou trop court', 'empty_content', '');
  }

  if (!hasPatchNotesStructure(html)) {
    throw new PatchPreflightError(
      'Structure patch notes absente dans la page',
      'empty_content',
      ''
    );
  }

  const entities = parsePatchHtml(html, locale);
  if (entities.length < MIN_ENTITY_COUNT) {
    throw new PatchPreflightError(
      `Aucune entité extraite (${entities.length})`,
      'empty_content',
      ''
    );
  }

  return entities.length;
}

/**
 * Fetch patch page once (no retry) for preflight checks.
 */
export async function probePatchPage(url: string): Promise<{ status: number; html: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const html = await response.text();
    return { status: response.status, html };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PatchPreflightError(
      `Impossible d'accéder à la page: ${message}`,
      'fetch_failed',
      url
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Run preflight check on EN patch URL before scraping.
 */
export async function runPatchPreflight(
  enUrl: string,
  locale: Locale = 'en-GB'
): Promise<PatchPreflightResult> {
  try {
    const { status, html } = await probePatchPage(enUrl);

    if (!status || status >= 400) {
      return mapHttpFailure(status, enUrl);
    }

    const entityCount = validatePatchHtmlContent(html, locale);
    return { ok: true, url: enUrl, status, entityCount };
  } catch (error) {
    if (error instanceof PatchPreflightError) {
      return {
        ok: false,
        url: error.url || enUrl,
        reason: error.reason,
        status: error.status,
        message: error.message,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      url: enUrl,
      reason: 'fetch_failed',
      message,
    };
  }
}

/**
 * Assert patch is ready to scrape; throws PatchPreflightError on failure.
 */
export async function assertPatchReadyToScrape(enUrl: string): Promise<number> {
  const result = await runPatchPreflight(enUrl);
  if (!result.ok) {
    throw new PatchPreflightError(result.message, result.reason, result.url, result.status);
  }
  return result.entityCount;
}
