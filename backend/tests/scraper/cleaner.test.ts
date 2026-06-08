import { describe, it, expect } from 'vitest';
import {
  cleanChanges,
  deduplicateEntities,
  sortEntities,
} from '../../src/scraper/cleaner.js';
import type { EntityChanges, ChangeType } from '../../src/scraper/types.js';

describe('cleaner', () => {
  describe('cleanChanges', () => {
    it('should filter entities with no changes', () => {
      const raw: EntityChanges[] = [
        {
          name: 'Empty Champion',
          category: 'champion',
          changes: [],
        },
        {
          name: 'Nami',
          category: 'champion',
          changes: [{
            stat: 'Damage',
            before: '100',
            after: '120',
            type: 'buff' as ChangeType,
          }],
        },
      ];

      const cleaned = cleanChanges(raw);
      expect(cleaned).toHaveLength(1);
      expect(cleaned[0].name).toBe('Nami');
    });

    it('should clean string values', () => {
      const raw: EntityChanges[] = [
        {
          name: '  Messy  Name  ',
          category: 'champion',
          changes: [{
            stat: '  Stat Name  ',
            before: '  100  ',
            after: '  120  ',
            type: 'buff' as ChangeType,
          }],
        },
      ];

      const cleaned = cleanChanges(raw);
      expect(cleaned[0].name).toBe('Messy Name');
      expect(cleaned[0].changes[0].stat).toBe('Stat Name');
      expect(cleaned[0].changes[0].before).toBe('100');
    });

    it('should deduplicate exact duplicate stat changes', () => {
      const raw: EntityChanges[] = [
        {
          name: 'Nami',
          category: 'champion',
          changes: [
            { stat: 'Damage', before: '100', after: '120', type: 'buff' as ChangeType },
            { stat: 'damage', before: '100', after: '120', type: 'buff' as ChangeType },
            { stat: 'Healing', before: '50', after: '60', type: 'buff' as ChangeType },
          ],
        },
      ];

      const cleaned = cleanChanges(raw);
      expect(cleaned[0].changes).toHaveLength(2);
      expect(cleaned[0].changes[0].stat).toBe('Damage');
      expect(cleaned[0].changes[1].stat).toBe('Healing');
    });

    it('should keep duplicate stat names on one entity when before/after differ', () => {
      const raw: EntityChanges[] = [
        {
          name: 'Quinn',
          category: 'champion',
          changes: [
            {
              stat: 'Dégâts aux monstres',
              before: '50',
              after: '75',
              type: 'buff' as ChangeType,
            },
            {
              stat: 'Dégâts aux monstres',
              before: '150%',
              after: '200%',
              type: 'buff' as ChangeType,
            },
          ],
        },
      ];

      const cleaned = cleanChanges(raw);
      expect(cleaned[0].changes).toHaveLength(2);
    });

    it('should keep multiple changes with the same stat name when values differ', () => {
      const raw: EntityChanges[] = [
        {
          name: 'Rêve éveillé',
          category: 'item',
          changes: [
            {
              stat: 'Réduction des dégâts de la bulle bleue',
              before: '75 - 255 (niveaux 1 à 18)',
              after: '50 - 194 (niveaux 1 à 18)',
              type: 'nerf' as ChangeType,
            },
            {
              stat: 'Réduction des dégâts de la bulle bleue',
              before: "la réduction des dégâts s'applique à la prochaine instance de dégâts non nulle, quelle qu'elle soit",
              after: "la réduction des dégâts s'applique à la prochaine source de dégâts non nulle (transfert temporel)",
              type: 'adjustment' as ChangeType,
            },
          ],
        },
      ];

      const cleaned = cleanChanges(raw);
      expect(cleaned[0].changes).toHaveLength(2);
      expect(cleaned[0].changes.every(c => c.stat === 'Réduction des dégâts de la bulle bleue')).toBe(true);
    });

    it('should normalize categories', () => {
      const raw: EntityChanges[] = [
        { name: 'Champ', category: 'CHAMPION' as any, changes: [{ stat: 'D', before: '1', after: '2', type: 'buff' as ChangeType }] },
        { name: 'Item', category: 'ITEMS' as any, changes: [{ stat: 'D', before: '1', after: '2', type: 'buff' as ChangeType }] },
        { name: 'Rune', category: 'runes' as any, changes: [{ stat: 'D', before: '1', after: '2', type: 'buff' as ChangeType }] },
      ];

      const cleaned = cleanChanges(raw);
      expect(cleaned[0].category).toBe('champion');
      expect(cleaned[1].category).toBe('item');
      expect(cleaned[2].category).toBe('rune');
    });
  });

  describe('deduplicateEntities', () => {
    it('should keep entity with most changes when duplicate names', () => {
      const entities: EntityChanges[] = [
        {
          name: 'Nami',
          category: 'champion',
          changes: [{ stat: 'A', before: '1', after: '2', type: 'buff' as ChangeType }],
        },
        {
          name: 'nami', // lowercase duplicate
          category: 'champion',
          changes: [
            { stat: 'A', before: '1', after: '2', type: 'buff' as ChangeType },
            { stat: 'B', before: '3', after: '4', type: 'buff' as ChangeType },
          ],
        },
      ];

      const deduped = deduplicateEntities(entities);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].changes).toHaveLength(2);
    });

    it('should not merge different entities', () => {
      const entities: EntityChanges[] = [
        { name: 'Nami', category: 'champion', changes: [{ stat: 'A', before: '1', after: '2', type: 'buff' as ChangeType }] },
        { name: 'Lux', category: 'champion', changes: [{ stat: 'A', before: '1', after: '2', type: 'buff' as ChangeType }] },
      ];

      const deduped = deduplicateEntities(entities);
      expect(deduped).toHaveLength(2);
    });

    it('should keep separate ability blocks for the same champion', () => {
      const entities: EntityChanges[] = [
        {
          name: 'Heimerdinger',
          category: 'champion',
          subCategory: 'A - Tourelle H-28G Évolution',
          changes: [{ stat: 'Portée', before: '530', after: '550', type: 'buff' as ChangeType }],
        },
        {
          name: 'Heimerdinger',
          category: 'champion',
          subCategory: 'E - Grenade électro-tempête CH-2',
          changes: [{ stat: 'Vision', before: '1 sec', after: '1,25 sec', type: 'buff' as ChangeType }],
        },
      ];

      const deduped = deduplicateEntities(entities);
      expect(deduped).toHaveLength(2);
    });
  });

  describe('sortEntities', () => {
    it('should sort by category then name', () => {
      const entities: EntityChanges[] = [
        { name: 'Rune B', category: 'rune', changes: [] },
        { name: 'Champion B', category: 'champion', changes: [] },
        { name: 'Item A', category: 'item', changes: [] },
        { name: 'Champion A', category: 'champion', changes: [] },
        { name: 'System', category: 'system', changes: [] },
      ];

      const sorted = sortEntities(entities);
      expect(sorted[0].name).toBe('Champion A');
      expect(sorted[1].name).toBe('Champion B');
      expect(sorted[2].name).toBe('Item A');
      expect(sorted[3].name).toBe('Rune B');
      expect(sorted[4].name).toBe('System');
    });
  });
});
