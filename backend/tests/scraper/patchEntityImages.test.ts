import { describe, it, expect } from 'vitest';
import {
  buildEntityImageCacheKey,
  extractPatchCdnVersion,
  resolveEntityRemoteImageUrl,
} from '../../src/scraper/patchEntityImages.js';
import { extractPatchImageSrc } from '../../src/scraper/entityIds.js';
import type { EntityChanges } from '../../src/scraper/types.js';

describe('patchEntityImages', () => {
  it('extracts ddragon champion url from akamai proxy', () => {
    const src =
      'https://am-a.akamaihd.net/image?f=http://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Azir.png';
    expect(extractPatchImageSrc(src)).toBe(
      'http://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Azir.png'
    );
  });

  it('extracts cmsassets item url', () => {
    const src =
      'https://cmsassets.rgpub.io/sanity/images/foo/bar-64x64.png?w=64&h=64';
    expect(extractPatchImageSrc(src)).toBe(
      'https://cmsassets.rgpub.io/sanity/images/foo/bar-64x64.png'
    );
  });

  it('reads cdn version from patch html', () => {
    const html =
      '<img src="https://am-a.akamaihd.net/image?f=http://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Azir.png">';
    expect(extractPatchCdnVersion(html)).toBe('16.16.1');
  });

  it('builds stable cache keys', () => {
    const entity: EntityChanges = {
      name: 'Azir',
      category: 'champion',
      id: 'Azir',
      changes: [],
    };
    const key = buildEntityImageCacheKey(
      entity,
      'http://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Azir.png'
    );
    expect(key).toMatch(/^champion-azir-[a-f0-9]{10}$/);
  });

  it('resolves champion ddragon url when entity has parsed image', () => {
    const entity: EntityChanges = {
      name: 'Azir',
      category: 'champion',
      id: 'Azir',
      imageUrl:
        'https://am-a.akamaihd.net/image?f=http://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Azir.png',
      changes: [],
    };
    expect(resolveEntityRemoteImageUrl(entity, '16.16.1')).toBe(
      'http://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Azir.png'
    );
  });

  it('falls back to ddragon from entity id', () => {
    const entity: EntityChanges = {
      name: 'Bel\'Veth',
      category: 'arena',
      subCategory: 'Champions',
      id: 'Belveth',
      changes: [],
    };
    expect(resolveEntityRemoteImageUrl(entity, '16.16.1')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Belveth.png'
    );
  });
});
