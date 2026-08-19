/**
 * Parser module - extracts structured patch data from HTML
 * Uses cheerio for DOM parsing
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { logger } from '../utils/logger.js';
import { extractEntityIdFromHtml, patchHeaderIdToSlug, championSlugToId, extractPatchImageSrc } from './entityIds.js';
import { inferNumericChangeType } from './changeType.js';
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

function looksLikePatchNoteLine(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /^(correction|fix|fixed|bug|note)\b/i.test(text) ||
    /\b(désormais|dorénavant|ne plus|no longer|renommé|renamed|privilégie|privilege)\b/i.test(
      lower
    ) ||
    /\b(notamment|afin de|pour corriger|to fix|bugfix)\b/i.test(lower)
  );
}

/**
 * Plain list item without arrow separator (bugfix-style notes on items/champions).
 */
function parsePlainListItemChange(text: string): StatChange | null {
  const normalized = text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized || !looksLikePatchNoteLine(normalized)) return null;

  const { stat, detail } = splitStatAndDetail(normalized);
  const hasNamedStat = stat !== detail && stat.length > 0 && stat.length <= 120;

  return {
    stat: hasNamedStat ? stat : '',
    before: '',
    after: hasNamedStat ? detail : normalized,
    type: 'text',
  };
}

/**
 * Extract stat name and value from a line
 * Format: "Stat Name: value ⇒ newValue"
 */
function parseStatChange(text: string, _locale: Locale): StatChange | null {
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
    type: inferNumericChangeType(beforeValue, afterValue, statName),
  };
}

/** h2 section ids with no stat changes to extract */
const SKIPPED_SECTION_IDS = [
  'patch-patch-highlights',
  'patch-pride',
  'patch-ranked',
  'patch-upcoming-skins',
  'patch-skins',
  'patch-upcoming-skins-and-chromas',
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
  if (text.includes('classic')) {
    return 'classic';
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

  if (id.includes('skin') || id.includes('chroma')) return 'skip';

  if (id.includes('support-adjust')) return 'item';
  if (id.includes('role-quest')) return 'system';
  if (id.includes('champion')) return 'champion';
  if (id.includes('item') || id.includes('objet')) return 'item';
  if (id.includes('rune')) return 'rune';
  if (id.includes('classic')) return 'classic';

  // ARAM modes (check chaos first, then regular ARAM)
  if (id.includes('aram') && (id.includes('chaos') || id.includes('mayhem'))) return 'aram-chaos';
  if (id.includes('aram')) return 'aram';
  
  // Arena mode
  if (id.includes('arena')) return 'arena';
  
  // Bug fixes (check heading text too for "correction" in FR)
  if (id.includes('bug') || id.includes('correct') || headingText.toLowerCase().includes('correction')) return 'bugfix';

  if (id.includes('last-hit') || id.includes('indicator')) return 'system';
  if (id.includes('systems') || id.endsWith('-system')) return 'system';

  if (isChampionReleaseSectionId(id)) return 'champion';

  return detectCategory(headingText);
}

/** Single-slug sections like patch-locke (new champion kit reveal). */
function isChampionReleaseSectionId(sectionId: string): boolean {
  if (!sectionId.startsWith('patch-')) return false;
  const slug = sectionId.slice('patch-'.length);
  if (!slug || slug.includes('-')) return false;
  const reserved = new Set(['top', 'ranked', 'pride', 'highlights', 'skins', 'classic', 'systems']);
  if (reserved.has(slug)) return false;
  return /^[a-z0-9]+$/.test(slug);
}

function inferChampionNameFromBlockquote(context: string): string | null {
  const match = context.match(/^([A-ZÀ-ÖØ-Þ][\w'’\-éèêëàâùûôîç]+),\s/);
  return match?.[1] ?? null;
}

function parseDescriptiveListItemChange(text: string): StatChange | null {
  const normalized = text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length < 8) return null;
  return {
    stat: '',
    before: '',
    after: normalized,
    type: 'text',
  };
}

function normalizeListItemLinkUrl(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim().split(/\s+/)[0]?.replace(/target=$/i, '');
  return trimmed || undefined;
}

function extractListItemContent(
  $li: cheerio.Cheerio<any>
): { text: string; linkUrl?: string; linkLabel?: string } {
  const $link = $li.find('a[href]').first();
  const linkUrl = normalizeListItemLinkUrl($link.attr('href'));
  const linkLabel = $link.text().replace(/\s+/g, ' ').trim() || undefined;
  const text = $li.text().replace(/\s+/g, ' ').trim();
  return { text, linkUrl, linkLabel };
}

function attachListItemLink(
  change: StatChange,
  linkUrl?: string,
  linkLabel?: string
): StatChange {
  if (!linkUrl) return change;
  return {
    ...change,
    linkUrl,
    ...(linkLabel ? { linkLabel } : {}),
  };
}

function parseListItemChange(
  $li: cheerio.Cheerio<any>,
  locale: Locale,
  options?: { allowDescriptive?: boolean }
): StatChange | null {
  const { text, linkUrl, linkLabel } = extractListItemContent($li);
  if (!text) return null;

  const statChange =
    (containsChangeSeparator(text)
      ? parseStatChange(text, locale)
      : parseTextOnlyChange(text, locale)) ??
    parsePlainListItemChange(text) ??
    (options?.allowDescriptive ? parseDescriptiveListItemChange(text) : null);

  return statChange ? attachListItemLink(statChange, linkUrl, linkLabel) : null;
}

function createChampionKitEntity(
  name: string,
  intro: string | null,
  sectionId: string
): EntityChanges {
  const changes: StatChange[] = [];
  if (intro) {
    changes.push({ stat: '', before: '', after: intro, type: 'text' });
  }

  const patchSlug = patchHeaderIdToSlug(sectionId);
  const slug = patchSlug ?? name.toLowerCase();
  const id = championSlugToId(slug) ?? name;

  return {
    name,
    category: 'champion',
    id,
    isNewRelease: true,
    ...(patchSlug ? { patchSlug } : {}),
    changes,
  };
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

function isAbilityOrBaseStatsHeading($elem: cheerio.Cheerio<any>, text: string): boolean {
  if ($elem.hasClass('ability-title')) return true;
  if (/^stats de base$/i.test(text) || /^base stats$/i.test(text)) return true;
  if (/^compétence passive\s*[-–—]/i.test(text) || /^passive ability\s*[-–—]/i.test(text)) {
    return true;
  }
  if (/^passif\s*[-–—]/i.test(text)) return true;
  return /^([QWERAZ]|Passive)\s*[-–—]/i.test(text);
}

function isChampionChangeSubSection(
  sectionCategory: EntityCategory,
  $elem: cheerio.Cheerio<any>,
  text: string
): boolean {
  return sectionCategory === 'champion' && isAbilityOrBaseStatsHeading($elem, text);
}

function tagChangeWithSubSection(
  change: StatChange,
  subSection: string | null,
  iconUrl?: string | null
): StatChange {
  if (!subSection) return change;
  return {
    ...change,
    subCategory: subSection,
    ...(iconUrl ? { iconUrl } : {}),
  };
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
  if (
    tagName === 'h4' &&
    !$elem.hasClass('change-detail-title') &&
    !$elem.hasClass('change-title')
  ) {
    return true;
  }
  return false;
}

function isBugfixHeading(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes('bug') || normalized.includes('correction');
}

function isEmptyHeading(text: string): boolean {
  return !text.replace(/\u00a0/g, ' ').trim();
}

function isStructuredSectionCategory(category: EntityCategory): boolean {
  return (
    category === 'classic' ||
    category === 'aram' ||
    category === 'aram-chaos' ||
    category === 'arena' ||
    category === 'bugfix'
  );
}

const STRUCTURED_SUBSECTION_RE =
  /^(champions?|items?|objets?|runes?|syst[eè]mes?|systems?|gameplay|corrections?|bug|honored guests|invit[eé]s d'honneur|skins?)/i;

function isSkinSubSectionHeading(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('skin') ||
    normalized.includes('cosmét') ||
    normalized.includes('cosmet') ||
    normalized.includes('chroma')
  );
}

function isStructuredSubSectionHeading(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (STRUCTURED_SUBSECTION_RE.test(normalized)) return true;
  if (/^[A-ZÀ-ÖØ-Þ0-9\s'’\-]{3,40}$/.test(normalized) && normalized === normalized.toUpperCase()) {
    return true;
  }
  return false;
}

function normalizeStructuredEntityHeading(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^\s*(nouveau|new)\s*/i, '')
    .trim();
}

const RUNE_SHARD_CATEGORY_RE =
  /^(marques?|sceaux|glyphes|quintessences?|marks?|seals?|glyphs?)$/i;

function isRuneShardCategoryHeading(text: string): boolean {
  return RUNE_SHARD_CATEGORY_RE.test(text.replace(/\s+/g, ' ').trim());
}

function ensureClassicRuneGroupEntity(
  state: SectionParseState,
  sectionCategory: EntityCategory
): void {
  if (state.currentEntity || !state.pendingName) return;

  const introChanges: StatChange[] = [];
  if (state.pendingContext) {
    introChanges.push({
      stat: '',
      before: '',
      after: state.pendingContext,
      type: 'text',
    });
  }

  state.currentEntity = createModeEntity(
    state.pendingName,
    sectionCategory,
    modeEntitySubCategory(state),
    introChanges
  );
  state.pendingContext = null;
  state.pendingName = null;
}

function inferContextEntityName(context: string): string {
  if (/larves?\s+du\s+n[eé]ant/i.test(context)) return 'Larves du Néant';
  const trimmed = context.replace(/\s+/g, ' ').trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

function getSectionBodyElements($: cheerio.CheerioAPI, $header: cheerio.Cheerio<any>): Element[] {
  const flattened: Element[] = [];
  let $sibling = $header.next();

  while ($sibling.length) {
    if ($sibling.is('header')) break;

    if ($sibling.is('div.content-border')) {
      $sibling.children('div').each((_, block) => {
        $(block)
          .children('div')
          .first()
          .children()
          .each((_, child) => {
            flattened.push(child);
          });
      });
    } else {
      const sibling = $sibling[0];
      if (sibling) {
        const tag = sibling.tagName?.toLowerCase();
        if (['h3', 'h4', 'h5', 'h6', 'ul', 'p', 'blockquote', 'hr'].includes(tag ?? '')) {
          flattened.push(sibling);
        } else {
          $sibling
            .find('h3, h4, h5, h6, ul, p, blockquote, hr')
            .each((_, child) => {
              flattened.push(child);
            });
        }
      }
    }

    $sibling = $sibling.next();
  }

  if (flattened.length > 0) return flattened;

  const $contentBorder = $header.next('div.content-border');
  if ($contentBorder.length) {
    $contentBorder.children('div').each((_, block) => {
      $(block)
        .children('div')
        .first()
        .children()
        .each((_, child) => {
          flattened.push(child);
        });
    });
    if (flattened.length > 0) return flattened;
  }

  const elements: Element[] = [];
  $sibling = $header.next();
  while ($sibling.length) {
    if ($sibling.is('header')) break;
    const sibling = $sibling[0];
    if (sibling) elements.push(sibling);
    $sibling = $sibling.next();
  }

  const legacyFlat: Element[] = [];
  for (const sibling of elements) {
    const tag = sibling.tagName?.toLowerCase();
    if (['h3', 'h4', 'h5', 'h6', 'ul', 'p', 'blockquote', 'hr'].includes(tag ?? '')) {
      legacyFlat.push(sibling);
      continue;
    }
    $(sibling)
      .find('h3, h4, h5, h6, ul, p, blockquote, hr')
      .each((_, child) => {
        legacyFlat.push(child);
      });
  }
  return legacyFlat;
}

function parseInlineEntityName(_$: cheerio.CheerioAPI, $p: cheerio.Cheerio<any>): string | null {
  const $strong = $p.children('strong, b');
  if ($strong.length !== 1) return null;

  const strongText = $strong.text().replace(/\s+/g, ' ').trim().replace(/:$/, '');
  if (!strongText || strongText.length > 80) return null;

  const pText = $p
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/:$/, '');

  if (pText === strongText || pText.startsWith(strongText)) {
    return strongText;
  }

  return null;
}

function parseListItems(
  $: cheerio.CheerioAPI,
  $ul: cheerio.Cheerio<any>,
  locale: Locale,
  options?: { allowDescriptive?: boolean }
): StatChange[] {
  const changes: StatChange[] = [];

  $ul.children('li').each((_, li) => {
    const statChange = parseListItemChange($(li), locale, options);
    if (statChange) {
      changes.push(statChange);
    }
  });

  return changes;
}

function createBugfixEntity(
  text: string,
  scope: EntityCategory,
  linkUrl?: string,
  linkLabel?: string
): EntityChanges {
  return {
    name: '',
    category: scope === 'bugfix' ? 'bugfix' : scope,
    ...(scope !== 'bugfix' ? { subCategory: 'Corrections de bugs' } : {}),
    changes: [
      attachListItemLink(
        {
          stat: '',
          before: '',
          after: text,
          type: 'text',
        },
        linkUrl,
        linkLabel
      ),
    ],
  };
}

function createEntityFromH3(
  _$: cheerio.CheerioAPI,
  $elem: cheerio.Cheerio<any>,
  sectionCategory: EntityCategory
): EntityChanges {
  const text = $elem.text().replace(/\s+/g, ' ').trim();
  const headerId = $elem.attr('id') ?? '';
  const href = $elem.find('a').attr('href') ?? '';
  const entityCategory = detectEntityCategoryFromHref(href, sectionCategory);
  const { id, imageUrl } = extractEntityIdFromHtml(href, headerId, entityCategory);
  const patchSlug = patchHeaderIdToSlug(headerId);

  return {
    name: text,
    category: entityCategory,
    ...(id ? { id } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(patchSlug ? { patchSlug } : {}),
    changes: [],
  };
}

function createModeEntity(
  name: string,
  sectionCategory: EntityCategory,
  subCategory: string | null,
  changes: StatChange[],
  imageUrl?: string
): EntityChanges {
  return {
    name,
    category: sectionCategory,
    ...(subCategory ? { subCategory } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    changes,
  };
}

function createContextSystemEntity(
  context: string,
  changes: StatChange[]
): EntityChanges {
  const entityChanges: StatChange[] = [
    {
      stat: '',
      before: '',
      after: context,
      type: 'text',
    },
    ...changes,
  ];

  return {
    name: inferContextEntityName(context),
    category: 'system',
    changes: entityChanges,
  };
}

interface SectionParseState {
  currentEntity: EntityChanges | null;
  /** Mode section heading (CHAMPIONS, OBJETS…) — preserved across entities. */
  structuredSubSection: string | null;
  /** Spell / ability label for tagging individual changes. */
  currentSubSection: string | null;
  inBugfixSubsection: boolean;
  inSkinSubsection: boolean;
  pendingContext: string | null;
  pendingName: string | null;
  /** Image src from a standalone <p><img> immediately before the next entity heading. */
  pendingEntityImageUrl: string | null;
  /** Spell/passive icon from the current ability heading. */
  currentSubSectionIconUrl: string | null;
  sectionHeading: string | null;
  sectionId: string;
}

function extractParagraphImageSrc($elem: cheerio.Cheerio<any>): string | undefined {
  const $img = $elem.find('img').first();
  const rawSrc = $img.attr('src') ?? $img.attr('data-src');
  if (!rawSrc?.trim()) return undefined;
  return extractPatchImageSrc(rawSrc) ?? rawSrc.trim();
}

function attachPendingEntityImage(
  entity: EntityChanges,
  state: SectionParseState
): EntityChanges {
  if (state.pendingEntityImageUrl && !entity.imageUrl) {
    entity.imageUrl = state.pendingEntityImageUrl;
  }
  state.pendingEntityImageUrl = null;
  return entity;
}

function setCurrentSubSection(
  state: SectionParseState,
  text: string,
  $elem?: cheerio.Cheerio<any>
): void {
  state.currentSubSection = text;
  const imageSrc = $elem ? extractParagraphImageSrc($elem) : undefined;
  state.currentSubSectionIconUrl = imageSrc ?? null;
}

function modeEntitySubCategory(state: SectionParseState): string | null {
  if (state.inBugfixSubsection) {
    return state.currentSubSection;
  }
  return state.structuredSubSection;
}

function parseSectionContent(
  $: cheerio.CheerioAPI,
  elements: Element[],
  sectionCategory: EntityCategory,
  locale: Locale,
  entities: EntityChanges[],
  sectionHeading: string,
  sectionId: string
): void {
  const state: SectionParseState = {
    currentEntity: null,
    structuredSubSection: null,
    currentSubSection: null,
    inBugfixSubsection: sectionCategory === 'bugfix',
    inSkinSubsection: false,
    pendingContext: null,
    pendingName: null,
    pendingEntityImageUrl: null,
    currentSubSectionIconUrl: null,
    sectionHeading,
    sectionId,
  };

  const flushCurrentEntity = () => {
    state.currentEntity = flushEntity(entities, state.currentEntity);
  };

  const clearPending = () => {
    state.pendingContext = null;
    state.pendingName = null;
  };

  const pushBugfix = (text: string, linkUrl?: string, linkLabel?: string) => {
    entities.push(createBugfixEntity(text, sectionCategory, linkUrl, linkLabel));
  };

  const flushPendingContextEntity = () => {
    if (!state.pendingContext) return;

    const name =
      state.pendingName ??
      state.sectionHeading ??
      inferContextEntityName(state.pendingContext);

    entities.push({
      name,
      category: sectionCategory === 'champion' ? 'champion' : 'system',
      changes: [
        {
          stat: '',
          before: '',
          after: state.pendingContext,
          type: 'text',
        },
      ],
    });
    clearPending();
  };

  const ensureChampionKitEntity = () => {
    if (state.currentEntity || sectionCategory !== 'champion') return;

    const name =
      state.pendingName ??
      inferChampionNameFromBlockquote(state.pendingContext ?? '') ??
      state.sectionHeading ??
      championSlugToId(patchHeaderIdToSlug(state.sectionId) ?? '') ??
      'Unknown';

    state.currentEntity = createChampionKitEntity(
      name,
      state.pendingContext,
      state.sectionId
    );
    state.pendingContext = null;
    state.pendingName = null;
  };

  const pushListAsBugfixes = ($ul: cheerio.Cheerio<any>) => {
    if (sectionCategory !== 'bugfix') {
      const changes: StatChange[] = [];
      $ul.children('li').each((_, li) => {
        const change = parseListItemChange($(li), locale, { allowDescriptive: true });
        if (change) changes.push(change);
      });
      if (changes.length > 0) {
        entities.push(
          createModeEntity('', sectionCategory, modeEntitySubCategory(state), changes)
        );
      }
      return;
    }

    $ul.children('li').each((_, li) => {
      const change = parseListItemChange($(li), locale, { allowDescriptive: true });
      if (change) pushBugfix(change.after, change.linkUrl, change.linkLabel);
    });
  };

  const pushListToEntity = ($ul: cheerio.Cheerio<any>, entity: EntityChanges) => {
    const allowDescriptive =
      sectionCategory === 'classic' ||
      (sectionCategory === 'champion' && isChampionReleaseSectionId(state.sectionId));
    const changes = parseListItems($, $ul, locale, { allowDescriptive });
    for (const change of changes) {
      const tagged = tagChangeWithSubSection(
        change,
        state.currentSubSection,
        state.currentSubSectionIconUrl
      );
      entity.changes.push(tagged);
      logger.debug(
        { entity: entity.name, stat: change.stat, type: change.type, subCategory: tagged.subCategory },
        'Found change'
      );
    }
  };

  const consumePendingList = ($ul: cheerio.Cheerio<any>) => {
    if (state.inSkinSubsection) {
      clearPending();
      return;
    }

    if (state.inBugfixSubsection || sectionCategory === 'bugfix') {
      pushListAsBugfixes($ul);
      clearPending();
      return;
    }

    if (state.pendingName) {
      flushCurrentEntity();
      const changes = parseListItems($, $ul, locale, {
        allowDescriptive: sectionCategory === 'classic',
      }).map(change =>
        tagChangeWithSubSection(change, state.currentSubSection, state.currentSubSectionIconUrl)
      );
      if (state.pendingContext) {
        changes.unshift({
          stat: '',
          before: '',
          after: state.pendingContext,
          type: 'text',
        });
      }
      const entity = attachPendingEntityImage(
        createModeEntity(
          state.pendingName,
          sectionCategory,
          modeEntitySubCategory(state),
          changes
        ),
        state
      );
      if (entity.changes.length > 0) {
        entities.push(entity);
      }
      clearPending();
      return;
    }

    if (state.pendingContext) {
      const changes = parseListItems($, $ul, locale, {
        allowDescriptive: isStructuredSectionCategory(sectionCategory),
      });
      if (changes.length > 0) {
        if (isStructuredSectionCategory(sectionCategory)) {
          const name =
            state.pendingName ??
            (state.currentSubSection && !isStructuredSubSectionHeading(state.currentSubSection)
              ? normalizeStructuredEntityHeading(state.currentSubSection)
              : '');
          entities.push(
            createModeEntity(
              name,
              sectionCategory,
              modeEntitySubCategory(state),
              [
                {
                  stat: '',
                  before: '',
                  after: state.pendingContext,
                  type: 'text',
                },
                ...changes,
              ]
            )
          );
        } else {
          entities.push(createContextSystemEntity(state.pendingContext, changes));
        }
      }
      clearPending();
      return;
    }

    if (state.currentEntity) {
      pushListToEntity($ul, state.currentEntity);
      return;
    }

    if (isStructuredSectionCategory(sectionCategory)) {
      const changes = parseListItems($, $ul, locale);
      if (changes.length > 0) {
        entities.push(
          createModeEntity('', sectionCategory, modeEntitySubCategory(state), changes)
        );
      }
    }
  };

  for (const elem of elements) {
    const $elem = $(elem);
    const tagName = elem.tagName?.toLowerCase() ?? '';
    const text = $elem.text().replace(/\s+/g, ' ').trim();

    if (tagName === 'hr') {
      if (!state.pendingName && sectionCategory !== 'champion') {
        clearPending();
      }
      continue;
    }

    if (tagName === 'h3') {
      flushCurrentEntity();
      clearPending();
      state.structuredSubSection = null;
      state.currentSubSection = null;
      state.inBugfixSubsection = sectionCategory === 'bugfix';
      state.currentEntity = attachPendingEntityImage(
        createEntityFromH3($, $elem, sectionCategory),
        state
      );
      continue;
    }

    if (tagName === 'h4') {
      if ($elem.hasClass('change-detail-title')) {
        if (isEmptyHeading(text)) continue;

        const isBugfix = isBugfixHeading(text);
        state.inBugfixSubsection = isBugfix;

        if (isBugfix) {
          flushCurrentEntity();
          clearPending();
          state.structuredSubSection = null;
          state.currentSubSection = text;
          state.inSkinSubsection = false;
        } else if (isStructuredSectionCategory(sectionCategory)) {
          flushCurrentEntity();
          clearPending();
          if (isStructuredSubSectionHeading(text)) {
            state.structuredSubSection = text;
            state.currentSubSection = null;
            state.inSkinSubsection = isSkinSubSectionHeading(text);
            state.pendingName = null;
          } else {
            state.inSkinSubsection = false;
            state.currentEntity = attachPendingEntityImage(
              createModeEntity(
                normalizeStructuredEntityHeading(text),
                sectionCategory,
                modeEntitySubCategory(state),
                []
              ),
              state
            );
          }
        } else if (!state.currentEntity && sectionCategory === 'system') {
          state.pendingName = text;
        } else if (isChampionChangeSubSection(sectionCategory, $elem, text)) {
          ensureChampionKitEntity();
          setCurrentSubSection(state, text, $elem);
        } else {
          state.currentSubSection = text;
          if (state.currentEntity && sectionCategory !== 'champion') {
            state.currentEntity.subCategory = text;
          }
        }
        continue;
      }

      if (state.currentEntity) {
        if (isChampionChangeSubSection(sectionCategory, $elem, text)) {
          setCurrentSubSection(state, text, $elem);
        } else if (sectionCategory !== 'champion') {
          state.currentEntity.subCategory = text;
        } else {
          state.currentSubSection = text;
        }
        continue;
      }

      flushCurrentEntity();
      clearPending();
      state.currentSubSection = text;
      state.inBugfixSubsection = isBugfixHeading(text);
      continue;
    }

    if (tagName === 'h5' || tagName === 'h6') {
      if (state.currentEntity) {
        if (state.currentEntity.category === 'champion') {
          setCurrentSubSection(state, text, $elem);
        } else {
          state.currentEntity.subCategory = text;
        }
      }
      continue;
    }

    if (tagName === 'blockquote') {
      if (state.inSkinSubsection) continue;
      const context = $elem.find('p').text().replace(/\s+/g, ' ').trim() || text;
      if (state.currentEntity && isStructuredSectionCategory(sectionCategory)) {
        if (context.length > 10) {
          state.currentEntity.changes.push({
            stat: '',
            before: '',
            after: context,
            type: 'text',
          });
        }
        continue;
      }
      if (state.currentEntity) continue;
      if (context.length > 10) {
        state.pendingContext = context;
        if (sectionCategory === 'champion') {
          const inferred = inferChampionNameFromBlockquote(context);
          if (inferred) state.pendingName = inferred;
        }
      }
      continue;
    }

    if (tagName === 'p') {
      if (state.inSkinSubsection) continue;
      if ($elem.find('ul').length > 0) continue;
      if ($elem.find('img').length > 0 && !$elem.find('strong, b').length) {
        const imageSrc = extractParagraphImageSrc($elem);
        if (imageSrc) {
          state.pendingEntityImageUrl = imageSrc;
        }
        continue;
      }

      const inlineName = parseInlineEntityName($, $elem);
      if (inlineName) {
        if (
          state.currentEntity &&
          isStructuredSectionCategory(sectionCategory) &&
          isAbilityOrBaseStatsHeading($elem, inlineName)
        ) {
          setCurrentSubSection(state, inlineName, $elem);
          continue;
        }
        if (
          state.pendingName &&
          isStructuredSectionCategory(sectionCategory) &&
          isRuneShardCategoryHeading(inlineName)
        ) {
          ensureClassicRuneGroupEntity(state, sectionCategory);
          state.currentSubSection = inlineName;
          continue;
        }
        if (
          state.currentEntity &&
          isStructuredSectionCategory(sectionCategory) &&
          isRuneShardCategoryHeading(inlineName)
        ) {
          state.currentSubSection = inlineName;
          continue;
        }
        flushCurrentEntity();
        state.pendingName = inlineName;
        continue;
      }

      if (state.currentEntity && isStructuredSectionCategory(sectionCategory)) {
        const $strong = $elem.find('strong, b');
        if (
          $strong.length === 1 &&
          $strong.text().trim().length > 0 &&
          $strong.text().trim().length < 80 &&
          !containsChangeSeparator(text)
        ) {
          state.currentSubSection = $strong.text().trim();
          continue;
        }
      }

      if (state.currentEntity) {
        const $strong = $elem.find('strong, b');
        if (
          $strong.length === 1 &&
          $strong.text().trim().length > 0 &&
          $strong.text().trim().length < 80 &&
          !containsChangeSeparator(text)
        ) {
          if (state.currentEntity.category === 'champion') {
            state.currentSubSection = $strong.text().trim();
          } else {
            state.currentEntity.subCategory = $strong.text().trim();
          }
          continue;
        }

        if (containsChangeSeparator(text)) {
          const statChange = parseStatChange(text, locale);
          if (statChange) {
            state.currentEntity.changes.push(
              tagChangeWithSubSection(
                statChange,
                state.currentSubSection,
                state.currentSubSectionIconUrl
              )
            );
          }
        }
      }
      continue;
    }

    if (tagName === 'ul') {
      consumePendingList($elem);
    }
  }

  flushPendingContextEntity();
  flushCurrentEntity();
}

function parseSection(
  $: cheerio.CheerioAPI,
  $header: cheerio.Cheerio<any>,
  sectionCategory: EntityCategory,
  locale: Locale,
  entities: EntityChanges[]
): void {
  const elements = getSectionBodyElements($, $header);
  if (elements.length === 0) return;

  const $h2 = $header.find('h2').first();
  const sectionHeading = $h2.text().replace(/\s+/g, ' ').trim();
  const sectionId = $h2.attr('id') ?? '';

  logger.debug(
    {
      category: sectionCategory,
      sectionId,
      elementCount: elements.length,
    },
    'Parsing section'
  );

  parseSectionContent($, elements, sectionCategory, locale, entities, sectionHeading, sectionId);
}

/**
 * Main parsing function - extracts all changes from patch notes HTML
 */
export function parsePatchHtml(html: string, locale: Locale): EntityChanges[] {
  const $ = cheerio.load(html);
  const entities: EntityChanges[] = [];
  const $content = findContentRoot($);

  logger.debug({ locale, root: $content.attr('id') ?? $content.get(0)?.tagName }, 'Starting parse');

  const $headers = $content.find('header.header-primary');
  if ($headers.length > 0) {
    $headers.each((_, headerEl) => {
      const $header = $(headerEl);
      const $h2 = $header.find('h2').first();
      const sectionId = $h2.attr('id') ?? '';
      const headingText = $h2.text().trim();
      const categoryResult = sectionId
        ? detectCategoryFromId(sectionId, headingText)
        : detectCategory(headingText);

      if (categoryResult === 'skip') {
        logger.debug({ sectionId, text: headingText.substring(0, 50) }, 'Skipping section');
        return;
      }

      const sectionCategory =
        categoryResult ?? (sectionId.startsWith('patch-') ? 'system' : null);
      if (!sectionCategory) return;

      parseSection($, $header, sectionCategory, locale, entities);
    });
  } else {
    // Fallback for minimal fixtures without header wrappers
    let currentCategory: EntityCategory | null = null;
    let currentEntity: EntityChanges | null = null;
    let skipSection = false;

    $content.find('h1, h2, h3, h4, h5, h6, ul, p, blockquote, hr').each((_, elem) => {
      const $elem = $(elem);
      const tagName = elem.tagName?.toLowerCase() ?? '';
      const text = $elem.text().replace(/\s+/g, ' ').trim();
      if (!text && tagName !== 'hr') return;

      if (tagName === 'h1' || tagName === 'h2') {
        currentEntity = flushEntity(entities, currentEntity);
        const sectionId = $elem.attr('id') ?? '';
        const categoryResult = sectionId
          ? detectCategoryFromId(sectionId, text)
          : detectCategory(text);

        if (categoryResult === 'skip') {
          skipSection = true;
          currentCategory = null;
          return;
        }

        skipSection = false;
        currentCategory =
          categoryResult ?? (sectionId.startsWith('patch-') ? 'system' : null);
        return;
      }

      if (skipSection || !currentCategory) return;

      if (isEntityHeader(tagName, $elem)) {
        if (detectCategory(text)) return;
        if (tagName === 'h4' && currentEntity) {
          currentEntity.subCategory = text;
          return;
        }
        currentEntity = flushEntity(entities, currentEntity);
        currentEntity = createEntityFromH3($, $elem, currentCategory);
        return;
      }

      if ((tagName === 'h5' || tagName === 'h6') && currentEntity) {
        currentEntity.subCategory = text;
        return;
      }

      if (tagName === 'ul' && currentEntity) {
        const changes = parseListItems($, $elem, locale);
        currentEntity.changes.push(...changes);
      }
    });

    flushEntity(entities, currentEntity);
  }

  logger.info(
    {
      locale,
      entityCount: entities.length,
      totalChanges: entities.reduce((sum, e) => sum + e.changes.length, 0),
    },
    'Parse complete'
  );

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
