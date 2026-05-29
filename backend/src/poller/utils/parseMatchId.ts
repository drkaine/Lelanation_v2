import type { Platform } from '../types.js';

export class ParseMatchIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseMatchIdError';
  }
}

const KNOWN_PLATFORMS = new Set<Platform>([
  'euw1',
  'eun1',
  'tr1',
  'ru',
  'na1',
  'br1',
  'la1',
  'la2',
  'kr',
  'jp1',
  'oc1',
  'ph2',
  'sg2',
  'th2',
  'tw2',
  'vn2',
]);

export function parsePlatformFromMatchId(matchId: string): Platform {
  const parts = matchId.split('_');
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new ParseMatchIdError(`Unrecognized matchId format: ${matchId}`);
  }
  const platform = parts[0].toLowerCase() as Platform;
  if (!KNOWN_PLATFORMS.has(platform)) {
    throw new ParseMatchIdError(`Unknown platform in matchId: ${matchId}`);
  }
  return platform;
}

export function isValidMatchId(matchId: string): boolean {
  try {
    parsePlatformFromMatchId(matchId);
    return true;
  } catch {
    return false;
  }
}
