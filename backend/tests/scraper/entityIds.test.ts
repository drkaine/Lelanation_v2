import { describe, it, expect } from 'vitest';
import {
  extractEntityIdFromHtml,
  championSlugToId,
  patchSlugToRuneKey,
  buildGameDataIndexes,
  enrichEntityIds,
} from '../../src/scraper/entityIds.js';
import type { EntityChanges } from '../../src/scraper/types.js';

describe('entityIds', () => {
  it('should extract item id from ddragon href', () => {
    const result = extractEntityIdFromHtml(
      'https://ddragon.leagueoflegends.com/cdn/16.10.1/img/item/4005.png',
      'patch-Imperial-Mandate',
      'item'
    );
    expect(result.id).toBe('4005');
  });

  it('should extract item id from akamai ddragon proxy', () => {
    const result = extractEntityIdFromHtml(
      'https://am-a.akamaihd.net/image?f=http://ddragon.leagueoflegends.com/cdn/16.10.1/img/item/3870.png',
      'patch-dream-maker',
      'item'
    );
    expect(result.id).toBe('3870');
  });

  it('should extract champion id from champion page url', () => {
    const result = extractEntityIdFromHtml(
      'https://www.leagueoflegends.com/fr-fr/champions/xinzhao/',
      'patch-xinzhao',
      'champion'
    );
    expect(result.id).toBe('XinZhao');
  });

  it('should extract champion id from patch header slug', () => {
    const result = extractEntityIdFromHtml(
      'https://www.leagueoflegends.com/en-us/how-to-play/',
      'patch-brand',
      'champion'
    );
    expect(result.id).toBe('Brand');
  });

  it('should extract rune key from patch header slug', () => {
    const result = extractEntityIdFromHtml(
      'https://cmsassets.rgpub.io/sanity/images/foo-64x64.png',
      'patch-Summon-Aery',
      'rune'
    );
    expect(result.id).toBe('SummonAery');
  });

  it('should map champion slugs with overrides', () => {
    expect(championSlugToId('xinzhao')).toBe('XinZhao');
    expect(championSlugToId('missfortune')).toBe('MissFortune');
    expect(championSlugToId('brand')).toBe('Brand');
  });

  it('should map rune patch slugs to keys', () => {
    expect(patchSlugToRuneKey('Summon-Aery')).toBe('SummonAery');
    expect(patchSlugToRuneKey('Conqueror')).toBe('Conqueror');
  });

  it('should enrich item and rune ids from game data indexes', () => {
    const indexes = buildGameDataIndexes(
      [{ id: 'Brand', name: 'Brand' }],
      {
        '4005': { name: 'Imperial Mandate' },
        '3084': { name: 'Heartsteel' },
      },
      [
        {
          slots: [
            {
              runes: [
                { id: 8214, key: 'SummonAery', name: 'Summon Aery' },
                { id: 8010, key: 'Conqueror', name: 'Conqueror' },
              ],
            },
          ],
        },
      ]
    );

    const entities: EntityChanges[] = [
      {
        name: 'Mandat impérial',
        category: 'item',
        patchSlug: 'Imperial-Mandate',
        changes: [{ stat: 'AP', before: '60', after: '65', type: 'buff' }],
      },
      {
        name: "Invocation d'Aery",
        category: 'rune',
        id: 'SummonAery',
        patchSlug: 'Summon-Aery',
        changes: [{ stat: 'AF', before: '5', after: '6', type: 'buff' }],
      },
    ];

    const enriched = enrichEntityIds(entities, indexes);
    expect(enriched[0].id).toBe('4005');
    expect(enriched[1].id).toBe('8214');
  });

  it('should enrich arena items, champions and honored guests from localized names', () => {
    const indexes = buildGameDataIndexes(
      [
        { id: 'MasterYi', name: 'Maître Yi' },
        { id: 'Kayle', name: 'Kayle' },
      ],
      {
        '3031': { name: "Lame d'infini" },
      },
      [{ slots: [{ runes: [] }] }]
    );

    const entities: EntityChanges[] = [
      {
        name: "Lame d'infini",
        category: 'arena',
        subCategory: 'Objets',
        changes: [{ stat: 'AD', before: '70', after: '65', type: 'nerf' }],
      },
      {
        name: 'Maître Yi',
        category: 'arena',
        subCategory: 'Champions',
        changes: [{ stat: 'R - Durée', before: '7', after: '5', type: 'nerf' }],
      },
      {
        name: 'Kayle : Ascension divine',
        category: 'arena',
        subCategory: "Invités d'honneur",
        changes: [{ stat: 'PO gagnées', before: '1000', after: '1500', type: 'buff' }],
      },
    ];

    const enriched = enrichEntityIds(entities, indexes);
    expect(enriched[0].id).toBe('3031');
    expect(enriched[1].id).toBe('MasterYi');
    expect(enriched[2].id).toBe('Kayle');
  });
});
