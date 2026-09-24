import { describe, expect, test } from 'vitest';
import { RegionRouter } from '../../../src/poller/RegionRouter.js';

describe('RegionRouter', () => {
  const platforms = RegionRouter.allPlatforms();

  test('maps all 17 platforms to clusters', () => {
    expect(platforms).toHaveLength(17);
    for (const platform of platforms) {
      expect(RegionRouter.getCluster(platform)).toMatch(/^(europe|americas|asia|sea)$/);
    }
  });

  test('returns https urls without trailing slash', () => {
    for (const platform of platforms) {
      const regional = RegionRouter.getRegionalUrl(platform);
      const platformUrl = RegionRouter.getPlatformUrl(platform);
      expect(regional.startsWith('https://')).toBe(true);
      expect(platformUrl.startsWith('https://')).toBe(true);
      expect(regional.endsWith('/')).toBe(false);
      expect(platformUrl.endsWith('/')).toBe(false);
    }
  });

  test('known cluster mapping samples', () => {
    expect(RegionRouter.getCluster('euw1')).toBe('europe');
    expect(RegionRouter.getCluster('na1')).toBe('americas');
    expect(RegionRouter.getCluster('kr')).toBe('asia');
    expect(RegionRouter.getCluster('oc1')).toBe('sea');
  });

  test('middle_east_platform_routes_to_europe_cluster', () => {
    expect([RegionRouter.getCluster('me1'), RegionRouter.getPlatformUrl('me1')]).toEqual([
      'europe',
      'https://me1.api.riotgames.com',
    ]);
  });
});
