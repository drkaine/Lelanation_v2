import { RiotGateway } from '../../../../src/riot-gateway/gateway/RiotGateway.js';
import { PollerEngine } from '../../../../src/poller/PollerEngine.js';
import type { PollConfig } from '../../../../src/poller/types.js';

export const LIVE_SINCE_DAYS = Number.parseInt(process.env.POLLER_LIVE_SINCE_DAYS ?? '2', 10);
export const LIVE_MAX_MATCHES = Number.parseInt(process.env.POLLER_LIVE_MAX_MATCHES ?? '2', 10);

export function livePollOptions(overrides?: Partial<PollConfig>): Partial<PollConfig> {
  const maxMatches = overrides?.maxMatchesToProcess ?? LIVE_MAX_MATCHES;
  return {
    sinceTimestamp: Math.floor(Date.now() / 1000) - LIVE_SINCE_DAYS * 24 * 3600,
    matchIdsPerPage: Math.min(20, Math.max(maxMatches, 1)),
    maxConcurrentMatchFetches: 2,
    participantRankConcurrency: 2,
    maxConcurrentPlayers: 1,
    maxMatchesToProcess: maxMatches,
    ...overrides,
  };
}

export async function resolveTestPuuid(): Promise<string> {
  const fromEnv = process.env.TEST_PUUID?.trim();
  if (fromEnv) return fromEnv;
  const platformUrl = (process.env.RIOT_PLATFORM_URL ?? 'https://euw1.api.riotgames.com').replace(/\/$/, '');
  const response = await fetch(`${platformUrl}/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`, {
    headers: { 'X-Riot-Token': process.env.RIOT_API_KEY ?? '', Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Challenger league ${response.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text) as { entries?: Array<{ puuid?: string }> };
  const puuid = data.entries?.find((e) => e.puuid)?.puuid;
  if (!puuid) throw new Error('TEST_PUUID missing and auto-resolve failed');
  return puuid;
}

export async function resetLivePoller(): Promise<void> {
  await PollerEngine.resetInstance();
  await RiotGateway.resetInstance();
}

export async function initLivePoller(): Promise<{ engine: PollerEngine; gateway: RiotGateway }> {
  await resetLivePoller();
  return { engine: PollerEngine.getInstance(), gateway: RiotGateway.getInstance() };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wait until the 120s app bucket has dispatch headroom (key-wide Riot counters). */
export async function waitForGatewayHeadroom(minAvailable = 10, maxWaitMs = 125_000): Promise<void> {
  const gateway = RiotGateway.getInstance();
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const bucket = gateway.getStatus().buckets.find((b) => b.windowMs === 120_000);
    if ((bucket?.available ?? 0) >= minAvailable) return;
    await sleep(500);
  }
}
