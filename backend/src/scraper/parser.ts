/**
 * Parser module - extracts structured patch data from HTML
 * Uses cheerio for DOM parsing
 */

import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';
import { extractEntityIdFromHtml, patchHeaderIdToSlug } from './entityIds.js';
import type { EntityChanges, StatChange, EntityCategory, Locale } from './types.js';

const CMS_IMAGE_HOST = 'cmsassets.rgpub.io';
const SUMMARY_IMAGE_SIZE_PATTERN = /1920x1080\.(png|jpe?g|webp)/i;
const CHAMPION_PAGE_RE = /\/champions\/[^/]+\/?$/i;

// Separators used by Riot to indicate changes (Unicode and HTML entities)
const CHANGE_SEPARATORS = ['\u21D2', '⇒', '&rArr;', '→', '&rarr;', '➔'];

/**
 * Detect if text contains a change separator
 */
function containsChangeSeparator(text: string): boolean {
  return CHANGE_SEPARATORS.some(sep => text.includes(sep));
}

/**
 * Split text by change separator into before/after parts
 */
function splitBySeparator(text: string): { before: string; after: string } | null {
  for (const sep of CHANGE_SEPARATORS) {
    const index = text.indexOf(sep);
    if (index !== -1) {
      return {
        before: text.substring(0, index).trim(),
        after: text.substring(index + sep.length).trim(),
      };
    }
  }
  return null;
}

/**
 * Split "Stat name: description" into parts
 */
function splitStatAndDetail(text: string): { stat: string; detail: string } {
  const colonIndex = text.indexOf(':');
  if (colonIndex !== -1) {
    return {
      stat: text.substring(0, colonIndex).trim(),
      detail: text.substring(colonIndex + 1).trim(),
    };
  }
  return { stat: text, detail: text };
}

/**
 * Parse text-only changes without numeric separators.
 * Riot uses REMOVED/NEW (EN) or SUPPRIMÉ/NOUVEAU (FR) prefixes.
 */
function parseTextOnlyChange(text: string, locale: Locale): StatChange | null {
  const normalized = text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const removedMatch = normalized.match(/^(?:SUPPRIMÉ|SUPPRIME|REMOVED)\s+(.+)$/i);
  if (removedMatch) {
    const description = removedMatch[1].trim();
    const { stat, detail } = splitStatAndDetail(description);
    return {
      stat,
      before: detail,
      after: locale === 'fr-FR' ? '(supprimé)' : '(removed)',
      type: 'removed',
    };
  }

  const newMatch = normalized.match(/^(?:NOUVEAU|NEW)\s+(.+)$/i);
  if (newMatch) {
    const description = newMatch[1].trim();
    const { stat, detail } = splitStatAndDetail(description);
    return {
      stat,
      before: locale === 'fr-FR' ? '(nouveau)' : '(new)',
      after: detail,
      type: 'new',
    };
  }

  const modifiedMatch = normalized.match(
    /^(?:MODIFIÉ|MODIFIE|MODIFIED|CHANGED|AJUSTÉ|AJUSTE|ADJUSTED)\s+(.+)$/i
  );
  if (modifiedMatch) {
    const description = modifiedMatch[1].trim();
    if (containsChangeSeparator(description)) {
      return parseStatChange(`${description}`, locale);
    }
    const { stat, detail } = splitStatAndDetail(description);
    return {
      stat,
      before: detail,
      after: detail,
      type: 'adjustment',
    };
  }

  return null;
}

/**
 * Extract stat name and value from a line
 * Format: "Stat Name: value ⇒ newValue"
 */
function parseStatChange(text: string, locale: Locale): StatChange | null {
  const split = splitBySeparator(text);
  if (!split) return null;

  // Try to extract stat name (text before colon)
  const colonIndex = split.before.indexOf(':');
  let statName: string;
  let beforeValue: string;

  if (colonIndex !== -1) {
    statName = split.before.substring(0, colonIndex).trim();
    beforeValue = split.before.substring(colonIndex + 1).trim();
  } else {
    // No colon found, use first word as stat name or generic label
    const words = split.before.split(/\s+/);
    if (words.length > 1) {
      statName = words[0];
      beforeValue = split.before;
    } else {
      statName = 'Change';
      beforeValue = split.before;
    }
  }

  // Clean up values
  beforeValue = beforeValue.replace(/^[:\-]+/, '').trim();
  const afterValue = split.after.replace(/^[:\-]+/, '').trim();

  if (!beforeValue && !afterValue) return null;

  return {
    stat: statName,
    before: beforeValue || '(empty)',
    after: afterValue || '(empty)',
    type: inferChangeType(beforeValue, afterValue, locale),
  };
}

/**
 * Infer change type by comparing numeric values
 */
function inferChangeType(before: string, after: string, locale: Locale): import('./types.js').ChangeType {
  // Extract first number from each string
  const beforeNum = extractFirstNumber(before, locale);
  const afterNum = extractFirstNumber(after, locale);

  if (beforeNum === null || afterNum === null) {
    return 'adjustment';
  }

  if (afterNum > beforeNum) {
    // Check context for damage/healing reductions (higher number = nerf)
    const lowerContext = before.toLowerCase() + ' ' + after.toLowerCase();
    if (lowerContext.includes('reduction') || lowerContext.includes('cooldown') || lowerContext.includes('cost')) {
      return 'nerf'; // Higher reduction/cooldown/cost = nerf
    }
    return 'buff';
  }

  if (afterNum < beforeNum) {
    const lowerContext = before.toLowerCase() + ' ' + after.toLowerCase();
    if (lowerContext.includes('reduction') || lowerContext.includes('cooldown') || lowerContext.includes('cost')) {
      return 'buff'; // Lower reduction/cooldown/cost = buff
    }
    return 'nerf';
  }

  return 'adjustment';
}

/**
 * Extract first number from a string (handles various formats)
 */
function extractFirstNumber(text: string, _locale: Locale): number | null {
  // Handle percentage and various number formats
  // en-GB: 1,234.56 or 1234.56
  // fr-FR: 1 234,56 or 1234,56

  const normalized = text
    .replace(/\s/g, '') // Remove spaces (used as thousand separators in FR)
    .replace(/,/g, '.'); // Convert comma to dot (FR decimal separator)

  // Match various number patterns
  const patterns = [
    /(\d+(?:\.\d+)?)%?/, // Basic number with optional decimal
    /(\d+)\s*-\s*(\d+)/, // Range like "50 - 170"
    /(\d+)\.\d+/, // Decimal
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num)) return num;
    }
  }

  return null;
}

/** h2 section ids with no stat changes to extract */
const SKIPPED_SECTION_IDS = [
  'patch-patch-highlights',
  'patch-pride',
  'patch-ranked',
  'patch-upcoming-skins',
  'patch-bugfixes',
  'title',
];

/**
 * Detect entity category from section heading text (EN + FR)
 */
function detectCategory(headingText: string): EntityCategory | null {
  const text = headingText.toLowerCase();

  if (text.includes('champion')) {
    return 'champion';
  }
  if (text.includes('item') || text.includes('objet')) {
    return 'item';
  }
  if (text.includes('rune')) {
    return 'rune';
  }
  if (text.includes('system') || text.includes('système') || text.includes('gameplay')) {
    return 'system';
  }

  return null;
}

/**
 * Detect category from Riot h2 id (e.g. patch-champions, patch-items)
 */
function detectCategoryFromId(sectionId: string, headingText: string): EntityCategory | 'skip' | null {
  const id = sectionId.toLowerCase();

  if (SKIPPED_SECTION_IDS.some(skip => id.includes(skip))) {
    return 'skip';
  }

  if (id.includes('support-adjust')) return 'item';
  if (id.includes('champion')) return 'champion';
  if (id.includes('item') || id.includes('objet')) return 'item';
  if (id.includes('rune')) return 'rune';

  return detectCategory(headingText);
}

/**
 * Infer entity category from h3 anchor href (support section mixes runes + items)
 */
function detectEntityCategoryFromHref(href: string, sectionCategory: EntityCategory | null): EntityCategory {
  if (href.includes('/img/item/') || /item\/\d+\.png/i.test(href)) {
    return 'item';
  }
  if (href.includes('/img/champion/') || /champion\/[^/]+\.png/i.test(href)) {
    return 'champion';
  }
  if (CHAMPION_PAGE_RE.test(href)) {
    return 'champion';
  }
  if (href.includes('cmsassets.rgpub.io')) {
    return 'rune';
  }
  if (sectionCategory) {
    return sectionCategory;
  }
  return 'system';
}

function flushEntity(
  entities: EntityChanges[],
  currentEntity: EntityChanges | null
): EntityChanges | null {
  if (currentEntity && currentEntity.changes.length > 0) {
    entities.push(currentEntity);
  }
  return null;
}

function findContentRoot($: cheerio.CheerioAPI): cheerio.Cheerio<any> {
  const riotSelectors = [
    '#patch-notes-container',
    '[id="patch-notes-container"]',
    'article',
    'main',
    'body',
  ];

  for (const selector of riotSelectors) {
    const $found = $(selector);
    if ($found.length > 0) {
      return $found.first();
    }
  }

  return $('body');
}

function isEntityHeader(tagName: string, $elem: cheerio.Cheerio<any>): boolean {
  if (tagName === 'h3') return true;
  if (tagName === 'h4' && !$elem.hasClass('change-title')) return true;
  return false;
}

/**
 * Main parsing function - extracts all changes from patch notes HTML
 */
export function parsePatchHtml(html: string, locale: Locale): EntityChanges[] {
  const $ = cheerio.load(html);
  const entities: EntityChanges[] = [];

  let currentCategory: EntityCategory | null = null;
  let currentEntity: EntityChanges | null = null;
  let skipSection = false;

  const $content = findContentRoot($);

  logger.debug({ locale, root: $content.attr('id') ?? $content.get(0)?.tagName }, 'Starting parse');

  const elements = $content.find('h1, h2, h3, h4, h5, h6, ul, p');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements.each((_: number, elem: any) => {
    const $elem = $(elem);
    const tagName = elem.tagName.toLowerCase();
    const text = $elem.text().trim();

    if (!text) return;

    // Section headers (h1, h2)
    if (tagName === 'h1' || tagName === 'h2') {
      currentEntity = flushEntity(entities, currentEntity);

      const sectionId = $elem.attr('id') ?? '';
      const categoryResult = sectionId
        ? detectCategoryFromId(sectionId, text)
        : detectCategory(text);

      if (categoryResult === 'skip') {
        skipSection = true;
        currentCategory = null;
        logger.debug({ sectionId, text: text.substring(0, 50) }, 'Skipping section');
        return;
      }

      skipSection = false;
      if (categoryResult) {
        currentCategory = categoryResult;
        logger.debug({ category: categoryResult, sectionId, text: text.substring(0, 50) }, 'Detected category');
      } else if (sectionId.startsWith('patch-')) {
        currentCategory = 'system';
      }
      return;
    }

    if (skipSection || !currentCategory) return;

    // Entity headers — Riot uses h3.change-title, fixtures use plain h3/h4
    if (isEntityHeader(tagName, $elem)) {
      if (detectCategory(text)) return;

      if (tagName === 'h4' && currentEntity) {
        currentEntity.subCategory = text.replace(/\s+/g, ' ').trim();
        return;
      }

      currentEntity = flushEntity(entities, currentEntity);

      const headerId = $elem.attr('id') ?? '';
      const href = $elem.find('a').attr('href') ?? '';
      const entityCategory = detectEntityCategoryFromHref(href, currentCategory);
      const { id, imageUrl } = extractEntityIdFromHtml(href, headerId, entityCategory);
      const patchSlug = patchHeaderIdToSlug(headerId);

      currentEntity = {
        name: text.replace(/\s+/g, ' ').trim(),
        category: entityCategory,
        ...(id ? { id } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(patchSlug ? { patchSlug } : {}),
        changes: [],
      };
      return;
    }

    // Sub-category (ability name, passive, etc.)
    if ((tagName === 'h5' || tagName === 'h6') && currentEntity) {
      currentEntity.subCategory = text.replace(/\s+/g, ' ').trim();
      return;
    }

    // Bold text sub-category (non-stat lines)
    if ((tagName === 'p' || tagName === 'div') && currentEntity) {
      const $strong = $elem.find('strong, b');
      if ($strong.length === 1 && $strong.text().trim().length > 0 && $strong.text().trim().length < 80) {
        if (!containsChangeSeparator($elem.text())) {
          currentEntity.subCategory = $strong.text().trim();
          return;
        }
      }
    }

    // Stat changes in lists (primary) or standalone paragraphs
    if ((tagName === 'ul' || tagName === 'p') && currentEntity) {
      // Skip paragraphs that wrap lists — ul handles those
      if (tagName === 'p' && $elem.find('ul').length > 0) return;

      const items = tagName === 'ul'
        ? $elem.children('li').map((_, li) => $(li).text().trim()).get()
        : [text];

      for (const itemText of items) {
        if (!itemText) continue;

        const statChange = containsChangeSeparator(itemText)
          ? parseStatChange(itemText, locale)
          : parseTextOnlyChange(itemText, locale);

        if (statChange) {
          currentEntity.changes.push(statChange);
          logger.debug(
            { entity: currentEntity.name, stat: statChange.stat, type: statChange.type },
            'Found change'
          );
        }
      }
    }
  });

  flushEntity(entities, currentEntity);

  logger.info({
    locale,
    entityCount: entities.length,
    totalChanges: entities.reduce((sum, e) => sum + e.changes.length, 0),
  }, 'Parse complete');

  return entities;
}

/**
 * Legacy parser for alternative HTML structures
 * Some patch notes use different class-based structures
 */
export function parsePatchHtmlAlt(html: string, _locale: Locale): EntityChanges[] {
  const $ = cheerio.load(html);
  const entities: EntityChanges[] = [];

  // Try to find patch notes with specific class patterns
  const changeBlocks = $('[class*="patch-note"], [class*="change"], [class*="update"], .c-champion, .c-skin');

  changeBlocks.each((_, block) => {
    const $block = $(block);
    const title = $block.find('h3, h4, [class*="title"], [class*="name"]').first().text().trim();

    if (!title) return;

    const entity: EntityChanges = {
      name: title,
      category: 'champion', // default, may be overridden
      changes: [],
    };

    // Find all text containing change separators
    $block.find('li, p, div[class*="description"], span[class*="change"]').each((_, el) => {
      const text = $(el).text().trim();
      if (!containsChangeSeparator(text)) return;

      const statChange = parseStatChange(text, _locale);
      if (statChange) {
        entity.changes.push(statChange);
      }
    });

    if (entity.changes.length > 0) {
      entities.push(entity);
    }
  });

  return entities;
}

export interface ExtractedSummaryImage {
  url: string;
  width?: number;
  height?: number;
}

/**
 * Normalize a CMS image URL (strip query params, decode HTML entities)
 */
export function normalizeCmsImageUrl(rawUrl: string): string {
  return rawUrl
    .replace(/&amp;/g, '&')
    .split('?')[0]
    .trim();
}

function isSummaryInfographicUrl(url: string): boolean {
  return url.includes(CMS_IMAGE_HOST) && SUMMARY_IMAGE_SIZE_PATTERN.test(url);
}

function parseImageDimensions($img: cheerio.Cheerio<any>): { width?: number; height?: number } {
  const width = Number.parseInt($img.attr('width') ?? '', 10);
  const height = Number.parseInt($img.attr('height') ?? '', 10);

  return {
    width: Number.isFinite(width) ? width : undefined,
    height: Number.isFinite(height) ? height : undefined,
  };
}

/**
 * Extract the patch summary infographic URL from HTML.
 * Uses the displayed <img src> inside #patch-patch-highlights (not the <a href>).
 */
export function extractSummaryImageUrl(html: string): ExtractedSummaryImage | null {
  const $ = cheerio.load(html);

  const highlightsHeader = $('[id*="patch-highlights"], [id*="patch_highlights"]').first();
  if (highlightsHeader.length > 0) {
    const $section = highlightsHeader.closest('header').nextUntil('header');
    const $img = $section
      .find('img[src]')
      .filter((_, el) => isSummaryInfographicUrl($(el).attr('src') ?? ''))
      .first();

    const src = $img.attr('src');
    if (src) {
      const dims = parseImageDimensions($img);
      logger.debug({ url: normalizeCmsImageUrl(src), source: 'patch-highlights' }, 'Found summary image');
      return { url: normalizeCmsImageUrl(src), ...dims };
    }
  }

  // Fallback: first 1920x1080 CMS infographic in article content
  const $articleImg = $('article img[src], main img[src], body img[src]')
    .filter((_, el) => isSummaryInfographicUrl($(el).attr('src') ?? ''))
    .first();

  const fallbackSrc = $articleImg.attr('src');
  if (fallbackSrc) {
    const dims = parseImageDimensions($articleImg);
    logger.warn({ url: normalizeCmsImageUrl(fallbackSrc), source: 'fallback' }, 'Summary image found via fallback');
    return { url: normalizeCmsImageUrl(fallbackSrc), ...dims };
  }

  // Last resort: regex on raw HTML (handles escaped JSON blobs)
  const regexMatch = html.match(
    /patch[_-]highlights[\s\S]{0,6000}?<img[^>]+src=["'](https:\/\/cmsassets\.rgpub\.io\/[^"']*1920x1080\.(?:png|jpe?g|webp))["']/i
  );
  if (regexMatch?.[1]) {
    const url = normalizeCmsImageUrl(regexMatch[1].replace(/\\u002F/g, '/'));
    logger.warn({ url, source: 'regex' }, 'Summary image found via regex');
    return { url };
  }

  logger.warn('No summary infographic found in patch HTML');
  return null;
}

/**
 * Build filename extension from image URL
 */
export function getImageExtension(url: string): string {
  const match = url.match(/\.(png|jpe?g|webp)(?:\?|$)/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'png';
}

/**
 * Build summary image filename for a patch locale
 */
export function buildSummaryImageFilename(patchVersion: string, locale: Locale, url: string): string {
  const ext = getImageExtension(url);
  return `patch-${patchVersion}-${locale}-summary.${ext}`;
}
