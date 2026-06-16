/**
 * Cleaner module - normalizes and deduplicates patch changes
 */

import { inferNumericChangeType } from './changeType.js';
import { logger } from '../utils/logger.js';
import type { EntityChanges, StatChange, EntityCategory } from './types.js';

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
        ...(change.subCategory ? { subCategory: cleanString(change.subCategory) } : {}),
      };

      // Skip empty changes (allow text-only bugfix lines with empty stat)
      if (!cleanChange.after && !cleanChange.before) {
        continue;
      }
      if (!cleanChange.stat && !cleanChange.before && !cleanChange.after) {
        continue;
      }

      // Skip exact duplicate lines (same stat + before + after)
      const statKey = cleanChange.stat
        ? `${cleanChange.subCategory?.toLowerCase() ?? ''}::${cleanChange.stat.toLowerCase()}::${cleanChange.before.toLowerCase()}::${cleanChange.after.toLowerCase()}`
        : `__text__:${cleanChange.subCategory?.toLowerCase() ?? ''}::${cleanChange.before.toLowerCase()}::${cleanChange.after.toLowerCase()}`;
      if (seenStats.has(statKey)) {
        logger.debug({ entity: cleanEntity.name, stat: cleanChange.stat }, 'Skipping duplicate stat');
        continue;
      }
      seenStats.add(statKey);

      if (
        cleanChange.type === 'adjustment' ||
        cleanChange.type === 'buff' ||
        cleanChange.type === 'nerf'
      ) {
        cleanChange.type = inferNumericChangeType(
          cleanChange.before,
          cleanChange.after,
          cleanChange.stat
        );
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
  
  // ARAM modes
  if (normalized.includes('aram-chaos') || normalized.includes('chaos')) return 'aram-chaos';
  if (normalized.includes('aram')) return 'aram';
  
  // Arena
  if (normalized.includes('arena')) return 'arena';
  
  // Bug fixes
  if (normalized.includes('bugfix') || normalized.includes('bug')) return 'bugfix';

  return 'system';
}

/**
 * Merge multiple rows for the same entity (e.g. champion split per ability).
 */
export function mergeEntityVariants(entities: EntityChanges[]): EntityChanges[] {
  const merged = new Map<string, EntityChanges>();

  for (const entity of entities) {
    const key = entity.name
      ? `${entity.category}::${entity.name.toLowerCase().trim()}`
      : `__unnamed__:${entity.category}:${entity.changes[0]?.after?.slice(0, 80) ?? ''}`;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entity,
        changes: entity.changes.map((change) =>
          change.subCategory || !entity.subCategory
            ? change
            : { ...change, subCategory: entity.subCategory }
        ),
      });
      continue;
    }

    for (const change of entity.changes) {
      const normalized =
        change.subCategory || !entity.subCategory
          ? change
          : { ...change, subCategory: entity.subCategory };
      existing.changes.push(normalized);
    }

    if (!existing.id && entity.id) existing.id = entity.id;
    if (!existing.patchSlug && entity.patchSlug) existing.patchSlug = entity.patchSlug;
    if (!existing.imageUrl && entity.imageUrl) existing.imageUrl = entity.imageUrl;
  }

  return Array.from(merged.values());
}

/**
 * Remove duplicate entities (by category + name, keeping the one with most changes)
 */
export function deduplicateEntities(entities: EntityChanges[]): EntityChanges[] {
  const byKey = new Map<string, EntityChanges[]>();

  for (const entity of entities) {
    const key = entity.name
      ? `${entity.category}::${entity.name.toLowerCase().trim()}`
      : `__unnamed__:${entity.category}:${entity.changes[0]?.after?.slice(0, 80) ?? ''}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
    }
    byKey.get(key)!.push(entity);
  }

  const deduplicated: EntityChanges[] = [];

  for (const [, duplicates] of byKey) {
    if (duplicates.length === 1) {
      deduplicated.push(duplicates[0]);
    } else {
      // Keep the one with most changes
      const best = duplicates.reduce((a, b) =>
        a.changes.length >= b.changes.length ? a : b
      );
      logger.debug(
        { entity: best.name, category: best.category, duplicates: duplicates.length, kept: best.changes.length },
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
    aram: 5,
    'aram-chaos': 6,
    arena: 7,
    bugfix: 8,
  };

  return [...entities].sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;
    return (a.subCategory ?? '').localeCompare(b.subCategory ?? '');
  });
}
