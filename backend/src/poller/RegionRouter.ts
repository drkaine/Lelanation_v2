import type { Platform, RegionalCluster } from './types.js';

export class RegionRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegionRouterError';
  }
}

const PLATFORM_TO_CLUSTER: Record<Platform, RegionalCluster> = {
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea',
};

const CLUSTER_BASE_URL: Record<RegionalCluster, string> = {
  europe: 'https://europe.api.riotgames.com',
  americas: 'https://americas.api.riotgames.com',
  asia: 'https://asia.api.riotgames.com',
  sea: 'https://sea.api.riotgames.com',
};

const PLATFORM_BASE_URL: Record<Platform, string> = {
  euw1: 'https://euw1.api.riotgames.com',
  eun1: 'https://eun1.api.riotgames.com',
  tr1: 'https://tr1.api.riotgames.com',
  ru: 'https://ru.api.riotgames.com',
  na1: 'https://na1.api.riotgames.com',
  br1: 'https://br1.api.riotgames.com',
  la1: 'https://la1.api.riotgames.com',
  la2: 'https://la2.api.riotgames.com',
  kr: 'https://kr.api.riotgames.com',
  jp1: 'https://jp1.api.riotgames.com',
  oc1: 'https://oc1.api.riotgames.com',
  ph2: 'https://ph2.api.riotgames.com',
  sg2: 'https://sg2.api.riotgames.com',
  th2: 'https://th2.api.riotgames.com',
  tw2: 'https://tw2.api.riotgames.com',
  vn2: 'https://vn2.api.riotgames.com',
};

export class RegionRouter {
  static getCluster(platform: Platform): RegionalCluster {
    const cluster = PLATFORM_TO_CLUSTER[platform];
    if (!cluster) throw new RegionRouterError(`Unknown platform: ${platform}`);
    return cluster;
  }

  static getRegionalUrl(platform: Platform): string {
    return CLUSTER_BASE_URL[RegionRouter.getCluster(platform)];
  }

  static getPlatformUrl(platform: Platform): string {
    const url = PLATFORM_BASE_URL[platform];
    if (!url) throw new RegionRouterError(`Unknown platform: ${platform}`);
    return url;
  }

  static allPlatforms(): Platform[] {
    return Object.keys(PLATFORM_TO_CLUSTER) as Platform[];
  }
}
