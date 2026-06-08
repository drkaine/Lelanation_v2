/**
 * Helper utilities for patch scraping
 */

import { logger } from './logger.js';

/**
 * Extract patch version from URL
 * URL format: .../league-of-legends-patch-26-11-notes/
 * Returns: "26.11"
 */
export function extractPatchVersion(url: string): string {
  // Try various patterns
  const patterns = [
    /patch-(\d+)-(\d+)-?notes?/i,
    /patch[\s-]*(\d+)\.(\d+)/i,
    /patch[\s-]*(\d+)[-\.](\d+)/i,
    /(\d+)\.(\d+)[-\s]*patch/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const version = `${match[1]}.${match[2]}`;
      logger.debug({ url, version, pattern: pattern.source }, 'Extracted patch version');
      return version;
    }
  }

  // Fallback: try to find any version-like pattern
  const fallbackMatch = url.match(/(\d{1,2})[.-](\d{1,2})/);
  if (fallbackMatch) {
    const version = `${fallbackMatch[1]}.${fallbackMatch[2]}`;
    logger.warn({ url, version }, 'Using fallback patch version extraction');
    return version;
  }

  logger.error({ url }, 'Could not extract patch version from URL');
  throw new Error(`Could not extract patch version from URL: ${url}`);
}

/**
 * Game patch label (16.x) → Riot patch notes URL version (26.x on the website in 2026).
 */
export function patchLabelToNotesUrlVersion(patchLabel: string): string {
  const [major, minor] = patchLabel.split('.').map(Number);
  if (major === 16 && Number.isFinite(minor)) {
    return `26.${minor}`;
  }
  return patchLabel;
}

/** Riot website version in patch notes URLs (26.x) → game patch label (16.x). */
export function notesUrlVersionToPatchLabel(notesVersion: string): string {
  const [major, minor] = notesVersion.split('.').map(Number);
  if (major === 26 && Number.isFinite(minor)) {
    return `16.${minor}`;
  }
  return notesVersion;
}

/**
 * Riot uses two URL slug formats on the website:
 * - patch-26-1-notes … patch-26-3-notes (short)
 * - league-of-legends-patch-26-4-notes … (long)
 */
export function getPatchNotesUrlSlug(notesVersion: string): string {
  const [major, minor] = notesVersion.split('.').map(Number);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    throw new Error(`Invalid notes version for URL slug: ${notesVersion}`);
  }
  if (major === 26 && minor <= 3) {
    return `patch-${major}-${minor}-notes`;
  }
  return `league-of-legends-patch-${major}-${minor}-notes`;
}

/**
 * Build Riot patch notes URL from game version (e.g. "16.4.1" or "26.11" → patch 16.4 / 26.11)
 */
export function buildPatchNotesUrl(patchVersion: string, locale: 'en-gb' | 'en-us' = 'en-gb'): string {
  const normalized = patchLabelToNotesUrlVersion(
    patchVersion.trim().replace(/^v/i, '').split('.').slice(0, 2).join('.')
  );
  const slug = getPatchNotesUrlSlug(normalized);
  return `https://www.leagueoflegends.com/${locale}/news/game-updates/${slug}/`;
}

/**
 * Convert EN URL to FR URL
 */
export function getFrUrl(enUrl: string): string {
  return enUrl
    .replace('/en-us/', '/fr-fr/')
    .replace('/en-gb/', '/fr-fr/')
    .replace('/en/', '/fr-fr/');
}

/**
 * Convert FR URL to EN URL
 */
export function getEnUrl(frUrl: string): string {
  return frUrl
    .replace('/fr-fr/', '/en-gb/')
    .replace('/fr/', '/en-gb/');
}

/**
 * Validate patch notes URL
 */
export function isValidPatchUrl(url: string): boolean {
  const validDomains = [
    'leagueoflegends.com',
    'www.leagueoflegends.com',
  ];

  try {
    const parsed = new URL(url);
    return validDomains.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/**
 * Sanitize filename component
 */
export function sanitizeFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse date from patch notes page
 * Returns ISO string or null
 */
export function parsePatchDate(dateString: string): string | null {
  const formats = [
    // "May 28, 2025"
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
    // "28 May 2025"
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/,
    // "2025-05-28"
    /(\d{4})-(\d{2})-(\d{2})/,
    // "28/05/2025"
    /(\d{2})\/(\d{2})\/(\d{4})/,
  ];

  const months: Record<string, number> = {
    january: 0, janvier: 0, jan: 0,
    february: 1, février: 1, feb: 1, fév: 1,
    march: 2, mars: 2, mar: 2,
    april: 3, avril: 3, apr: 3, avr: 3,
    may: 4, mai: 4,
    june: 5, juin: 5, jun: 5,
    july: 6, juillet: 6, jul: 6, juil: 6,
    august: 7, août: 7, aug: 7,
    september: 8, septembre: 8, sep: 8, sept: 8,
    october: 9, octobre: 9, oct: 9,
    november: 10, novembre: 10, nov: 10,
    december: 11, décembre: 11, dec: 11, déc: 11,
  };

  for (let i = 0; i < formats.length; i++) {
    const pattern = formats[i];
    const match = dateString.match(pattern);
    if (!match) continue;

    try {
      let date: Date;

      if (i === 0) {
        // "May 28, 2025" - Month first
        const month = months[match[1].toLowerCase()];
        if (month === undefined) continue;
        date = new Date(parseInt(match[3]), month, parseInt(match[2]));
      } else if (i === 1) {
        // "28 May 2025" - Day first
        const month = months[match[2].toLowerCase()];
        if (month === undefined) continue;
        date = new Date(parseInt(match[3]), month, parseInt(match[1]));
      } else if (i === 2) {
        // "2025-05-28" - ISO format YYYY-MM-DD
        date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else if (i === 3) {
        // "28/05/2025" - DD/MM/YYYY
        date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      } else {
        continue;
      }

      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      continue;
    }
  }

  return null;
}
