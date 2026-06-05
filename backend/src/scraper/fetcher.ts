/**
 * Fetcher module - downloads patch notes HTML with retry logic
 * Uses native fetch (undici via Node.js 18+)
 */

import { logger } from '../utils/logger.js';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const DEFAULT_FETCH_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
} as const;

/**
 * Fetch HTML from URL with automatic retry and timeout
 */
export async function fetchPage(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      logger.debug({ url, attempt }, 'Fetching page');

      const response = await fetch(url, {
        signal: controller.signal,
        headers: DEFAULT_FETCH_HEADERS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      logger.debug({ url, attempt, size: html.length }, 'Page fetched successfully');
      return html;

    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.warn({
        url,
        attempt,
        maxRetries: retries,
        error: errorMessage,
        isLastAttempt,
      }, 'Fetch attempt failed');

      if (isLastAttempt) {
        throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${errorMessage}`);
      }

      // Exponential backoff
      const delayMs = RETRY_DELAY_BASE_MS * attempt;
      logger.debug({ url, attempt, delayMs }, 'Retrying after delay');
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`fetchPage: unreachable code path for ${url}`);
}

/**
 * Fetch binary content (images, etc.) with retry logic
 */
export async function fetchBinary(url: string, retries = MAX_RETRIES): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      logger.debug({ url, attempt }, 'Fetching binary');

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          ...DEFAULT_FETCH_HEADERS,
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      logger.debug({ url, attempt, size: buffer.length }, 'Binary fetched successfully');
      return buffer;

    } catch (error) {
      const isLastAttempt = attempt === retries;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.warn({
        url,
        attempt,
        maxRetries: retries,
        error: errorMessage,
        isLastAttempt,
      }, 'Binary fetch attempt failed');

      if (isLastAttempt) {
        throw new Error(`Failed to fetch binary ${url} after ${retries} attempts: ${errorMessage}`);
      }

      const delayMs = RETRY_DELAY_BASE_MS * attempt;
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`fetchBinary: unreachable code path for ${url}`);
}

/**
 * Add delay between requests to be respectful to the server
 */
export async function delayBetweenRequests(ms: number): Promise<void> {
  logger.debug({ delayMs: ms }, 'Adding delay between requests');
  await new Promise(resolve => setTimeout(resolve, ms));
}
