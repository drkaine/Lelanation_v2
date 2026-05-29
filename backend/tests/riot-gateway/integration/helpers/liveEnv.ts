import { riotConfig } from '../../../../src/riot-gateway/config/riotConfig.js';

export const MATCH_IDS_METHOD_KEY = '/lol/match/v5/matches/by-puuid/{puuid}/ids';

export function hasLiveApiKey(): boolean {
  return Boolean(process.env.RIOT_API_KEY?.startsWith('RGAPI-'));
}

let cachedPuuid: string | null = null;

async function fetchJson<T>(url: string): Promise<{ status: number; data: T }> {
  const apiKey = process.env.RIOT_API_KEY?.trim() ?? riotConfig.apiKey;
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey,
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : null) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`Riot API ${response.status} for ${url}: ${text.slice(0, 200)}`);
  }
  return { status: response.status, data };
}

export async function resolveTestPuuid(): Promise<string> {
  const fromEnv = process.env.TEST_PUUID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedPuuid) return cachedPuuid;

  const platformUrl = riotConfig.platformUrl.replace(/\/$/, '');
  const url = `${platformUrl}/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`;
  const { data } = await fetchJson<{ entries?: Array<{ puuid?: string }> }>(url);
  const puuid = data.entries?.find((entry) => entry.puuid)?.puuid;
  if (!puuid) {
    throw new Error(
      'TEST_PUUID missing and auto-resolve failed — set TEST_PUUID in .env or check RIOT_PLATFORM_URL',
    );
  }
  cachedPuuid = puuid;
  return puuid;
}

type RiotGateway = import('../../../../src/riot-gateway/gateway/RiotGateway.js').RiotGateway;

export function get120sAvailable(gateway: RiotGateway): number {
  const bucket = gateway.getStatus().buckets.find((b) => b.windowMs === 120_000);
  return bucket?.available ?? 0;
}

/** Riot rate-limit counts are key-wide; wait until the 120s window has headroom. */
export async function waitFor120sHeadroom(
  gateway: RiotGateway,
  minAvailable: number,
  maxWaitMs = 125_000,
): Promise<number> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const available = get120sAvailable(gateway);
    if (available >= minAvailable) return available;
    await sleep(500);
  }
  return get120sAvailable(gateway);
}

export async function resetGateway(): Promise<RiotGateway> {
  const { RiotGateway } = await import('../../../../src/riot-gateway/gateway/RiotGateway.js');
  await RiotGateway.resetInstance();
  return RiotGateway.getInstance();
}

export async function teardownGateway(): Promise<void> {
  const { RiotGateway } = await import('../../../../src/riot-gateway/gateway/RiotGateway.js');
  await RiotGateway.resetInstance();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
