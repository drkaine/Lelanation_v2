import { describe, it, expect } from 'vitest';
import type { StoredBuild } from '@lelanation/shared-types';
import type { EntityChanges } from '../../src/scraper/types.js';
import {
  evaluateBuildAgainstPatchBuckets,
  extractPatchEntityBuckets,
  resolveLatestMatchingPatchVersion,
  resolveLatestPatchStaleFlag,
  resolveNextPatchStaleFlag,
  shouldConsiderPatchForBuild,
} from '../../src/services/BuildPatchStaleService.js';

function buildFixture(overrides: Partial<StoredBuild> = {}): StoredBuild {
  return {
    id: 'build-1',
    name: 'Test',
    champion: { id: 'Brand', name: 'Brand', image: { full: 'Brand.png' } },
    items: [{ id: '4005', image: { full: '4005.png' } }],
    runes: {
      primary: { pathId: 8000, keystone: 8010, slot1: 9111, slot2: 9104, slot3: 8014 },
      secondary: { pathId: 8100, slot1: 8143, slot2: 8135 },
    },
    shards: { slot1: 5008, slot2: 5008, slot3: 5001 },
    summonerSpells: [null, null],
    skillOrder: null,
    roles: [],
    upvote: 0,
    downvote: 0,
    gameVersion: '16.10.1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('BuildPatchStaleService', () => {
  it('should ignore non champion/item/rune patch entities', () => {
    const entities: EntityChanges[] = [
      { name: 'Qiyana', category: 'aram', id: 'Qiyana', changes: [] },
      { name: 'Lame', category: 'arena', id: '3031', changes: [] },
      { name: 'Brand', category: 'champion', id: 'Brand', changes: [] },
    ];

    const buckets = extractPatchEntityBuckets(entities);
    expect([...buckets.champions]).toEqual(['Brand']);
    expect(buckets.items.size).toBe(0);
    expect(buckets.runes.size).toBe(0);
  });

  it('should flag build when champion item or rune is touched', () => {
    const buckets = extractPatchEntityBuckets([
      { name: 'Brand', category: 'champion', id: 'Brand', changes: [] },
      { name: 'Mandat', category: 'item', id: '4005', changes: [] },
      { name: 'Conqueror', category: 'rune', id: '8010', changes: [] },
    ]);

    const match = evaluateBuildAgainstPatchBuckets(buildFixture(), buckets);
    expect(match?.categories.sort()).toEqual(['champion', 'item', 'rune']);
  });

  it('should pick latest patch version that still matches the build', () => {
    const affected = new Map([
      [
        '16.10',
        extractPatchEntityBuckets([{ name: 'Brand', category: 'champion', id: 'Brand', changes: [] }]),
      ],
      [
        '16.11',
        extractPatchEntityBuckets([{ name: 'Mandat', category: 'item', id: '4005', changes: [] }]),
      ],
    ]);

    const result = resolveLatestMatchingPatchVersion(buildFixture(), affected, ['16.11', '16.10']);
    expect(result?.patchVersion).toBe('16.11');
    expect(result?.categories).toEqual(['item']);
  });

  it('should not flag build when gameVersion is equal to or newer than the patch', () => {
    const affected = new Map([
      [
        '16.9',
        extractPatchEntityBuckets([
          { name: 'Brand', category: 'champion', id: 'Brand', changes: [] },
        ]),
      ],
    ]);

    expect(
      resolveLatestMatchingPatchVersion(
        buildFixture({ gameVersion: '16.11.1' }),
        affected,
        ['16.9']
      )
    ).toBeNull();

    expect(
      resolveLatestMatchingPatchVersion(
        buildFixture({ gameVersion: '16.9.1' }),
        affected,
        ['16.9']
      )
    ).toBeNull();
  });

  it('should flag build when gameVersion is older than the matching patch', () => {
    const affected = new Map([
      [
        '16.9',
        extractPatchEntityBuckets([
          { name: 'Shyvana', category: 'champion', id: 'Shyvana', changes: [] },
        ]),
      ],
    ]);

    const result = resolveLatestMatchingPatchVersion(
      buildFixture({ champion: { id: 'Shyvana', name: 'Shyvana', image: { full: 'Shyvana.png' } }, gameVersion: '16.7.1' }),
      affected,
      ['16.9']
    );

    expect(result?.patchVersion).toBe('16.9');
    expect(result?.categories).toEqual(['champion']);
  });

  it('should treat missing gameVersion as eligible for flagging', () => {
    expect(shouldConsiderPatchForBuild(buildFixture({ gameVersion: '' }), '16.9')).toBe(true);
  });

  it('should flag unmarked build when latest patch touches its loadout', () => {
    const buckets = extractPatchEntityBuckets([
      { name: 'Brand', category: 'champion', id: 'Brand', changes: [] },
    ]);

    const result = resolveLatestPatchStaleFlag(
      buildFixture({ gameVersion: '16.10.1' }),
      null,
      buckets,
      '16.11'
    );

    expect(result?.patchVersion).toBe('16.11');
    expect(result?.categories).toEqual(['champion']);
  });

  it('should keep existing patchStale when latest patch JSON is missing', () => {
    const previous = {
      patchVersion: '16.11',
      flaggedAt: '2026-01-01T00:00:00.000Z',
      categories: ['champion'] as const,
    };

    const next = resolveNextPatchStaleFlag(
      'latest',
      buildFixture({ patchStale: previous }),
      previous,
      new Map(),
      [],
      '16.11',
      null
    );

    expect(next).toEqual(previous);
  });

  it('should not clear existing patchStale flag in latest mode', () => {
    const buckets = extractPatchEntityBuckets([
      { name: 'Brand', category: 'champion', id: 'Brand', changes: [] },
    ]);
    const previous = {
      patchVersion: '16.10',
      flaggedAt: '2026-01-01T00:00:00.000Z',
      categories: ['champion'] as const,
    };

    const result = resolveLatestPatchStaleFlag(
      buildFixture({ gameVersion: '16.11.1', patchStale: previous }),
      previous,
      buckets,
      '16.11'
    );

    expect(result).toEqual(previous);
  });

  it('should not add patchStale when build gameVersion is already on the latest patch', () => {
    const buckets = extractPatchEntityBuckets([
      { name: 'Brand', category: 'champion', id: 'Brand', changes: [] },
    ]);

    const result = resolveLatestPatchStaleFlag(
      buildFixture({ gameVersion: '16.11.1' }),
      null,
      buckets,
      '16.11'
    );

    expect(result).toBeNull();
  });
});
