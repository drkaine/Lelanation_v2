/**
 * Cleaner module - normalizes and deduplicates patch changes
 */

import { logger } from '../utils/logger.js';
import type { EntityChanges, StatChange, ChangeType, EntityCategory } from './types.js';

/**
 * Clean and normalize extracted changes
 */
export function cleanChanges(raw: EntityChanges[]): EntityChanges[] {
  const cleaned: EntityChanges[] = [];

  for (const entity of raw) {
    // Skip entities without any stat changes
    if (!entity.changes || entity.changes.length === 0) {
      logger.debug({ entity: entity.name }, 'Skipping entity with no changes');
      continue;
    }

    // Clean entity name and category
    const cleanEntity: EntityChanges = {
      name: cleanString(entity.name),
      category: normalizeCategory(entity.category),
      changes: [],
    };

    if (entity.id) {
      cleanEntity.id = cleanString(entity.id);
    }
    if (entity.imageUrl) {
      cleanEntity.imageUrl = entity.imageUrl.trim();
    }
    if (entity.patchSlug) {
      cleanEntity.patchSlug = cleanString(entity.patchSlug);
    }
    if (entity.subCategory) {
      cleanEntity.subCategory = cleanString(entity.subCategory);
    }

    // Deduplicate changes by stat name
    const seenStats = new Set<string>();

    for (const change of entity.changes) {
      const cleanChange: StatChange = {
        stat: cleanString(change.stat),
        before: cleanString(change.before),
        after: cleanString(change.after),
        type: change.type,
      };

      // Skip empty changes
      if (!cleanChange.stat || (!cleanChange.before && !cleanChange.after)) {
        continue;
      }

      // Skip duplicate stats (keep first occurrence)
      const statKey = `${cleanChange.stat.toLowerCase()}`;
      if (seenStats.has(statKey)) {
        logger.debug({ entity: cleanEntity.name, stat: cleanChange.stat }, 'Skipping duplicate stat');
        continue;
      }
      seenStats.add(statKey);

      // Recalculate type if needed
      if (cleanChange.type === 'adjustment') {
        cleanChange.type = recalculateChangeType(cleanChange.before, cleanChange.after);
      }

      cleanEntity.changes.push(cleanChange);
    }

    // Only add entities with valid changes
    if (cleanEntity.changes.length > 0) {
      cleaned.push(cleanEntity);
    }
  }

  logger.info(
    { before: raw.length, after: cleaned.length },
    'Changes cleaned'
  );

  return cleaned;
}

/**
 * Clean a string: trim, normalize whitespace, remove special chars
 */
function cleanString(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/\u00A0/g, ' ') // Replace non-breaking space
    .replace(/\u200B/g, '') // Remove zero-width space
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .trim();
}

/**
 * Normalize category to standard values
 */
function normalizeCategory(category: EntityCategory | string): EntityCategory {
  const normalized = category.toLowerCase().trim();

  if (normalized.includes('champion')) return 'champion';
  if (normalized.includes('item')) return 'item';
  if (normalized.includes('rune')) return 'rune';

  return 'system';
}

/**
 * Recalculate change type based on before/after values
 */
function recalculateChangeType(before: string, after: string): ChangeType {
  const beforeNum = extractFirstNumber(before);
  const afterNum = extractFirstNumber(after);

  if (beforeNum === null || afterNum === null) {
    return 'adjustment';
  }

  // Check for nerfs on beneficial stats or buffs on negative stats
  const lowerText = (before + ' ' + after).toLowerCase();
  const isNegativeStat =
    lowerText.includes('cooldown') ||
    lowerText.includes('cost') ||
    lowerText.includes('reduction') && !lowerText.includes('damage reduction');

  if (isNegativeStat) {
    // For negative stats (cooldown, cost), lower is better
    if (afterNum < beforeNum) return 'buff';
    if (afterNum > beforeNum) return 'nerf';
  } else {
    // For positive stats (damage, healing), higher is better
    if (afterNum > beforeNum) return 'buff';
    if (afterNum < beforeNum) return 'nerf';
  }

  return 'adjustment';
}

/**
 * Extract first number from string
 */
function extractFirstNumber(text: string): number | null {
  // Handle both dot and comma as decimal separator
  const normalized = text
    .replace(/\s/g, '')
    .replace(/,/g, '.');

  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Remove duplicate entities (by name, keeping the one with most changes)
 */
export function deduplicateEntities(entities: EntityChanges[]): EntityChanges[] {
  const byName = new Map<string, EntityChanges[]>();

  for (const entity of entities) {
    const key = entity.name.toLowerCase().trim();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key)!.push(entity);
  }

  const deduplicated: EntityChanges[] = [];

  for (const [, duplicates] of byName) {
    if (duplicates.length === 1) {
      deduplicated.push(duplicates[0]);
    } else {
      // Keep the one with most changes
      const best = duplicates.reduce((a, b) =>
        a.changes.length >= b.changes.length ? a : b
      );
      logger.debug(
        { entity: best.name, duplicates: duplicates.length, kept: best.changes.length },
        'Deduplicated entity'
      );
      deduplicated.push(best);
    }
  }

  return deduplicated;
}

/**
 * Sort entities by category then by name
 */
export function sortEntities(entities: EntityChanges[]): EntityChanges[] {
  const categoryOrder: Record<EntityCategory, number> = {
    champion: 1,
    item: 2,
    rune: 3,
    system: 4,
  };

  return [...entities].sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });
}
