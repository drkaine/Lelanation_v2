import { config } from "../config/index.js";
import type { MatchDto, MatchTimelineDto, MatchlistDto, RankDto } from "./types.js";

const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

const PLATFORM_BY_REGION: Record<string, string> = {
  euw: "euw1",
  euw1: "euw1",
};

const REGIONAL_BY_REGION: Record<string, string> = {
  euw: "europe",
  euw1: "europe",
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class RateLimitError extends ApiError {
  constructor(url: string, body?: unknown) {
    super("Riot API rate limit reached (429)", 429, url, body);
    this.name = "RateLimitError";
  }
}

export class NotFoundError extends ApiError {
  constructor(url: string, body?: unknown) {
    super("Riot API resource not found (404)", 404, url, body);
    this.name = "NotFoundError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRegion(region: string): string {
  return region.trim().toLowerCase();
}

function getPlatformHost(region: string): string {
  const key = normalizeRegion(region);
  return `${PLATFORM_BY_REGION[key] ?? key}.api.riotgames.com`;
}

function getRegionalHost(region: string): string {
  const key = normalizeRegion(region);
  return `${REGIONAL_BY_REGION[key] ?? key}.api.riotgames.com`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class RiotClient {
  private readonly apiKey: string;

  constructor(apiKey = config.RIOT_API_KEY) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(url: string): Promise<T> {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Riot-Token": this.apiKey,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const body = await parseResponseBody(response);

      if (response.status === 429) {
        console.error(`[riot-alarm] 429 unexpected with Lua limiter: ${url}`);
        throw new RateLimitError(url, body);
      }

      if (response.status === 404) {
        console.warn(`[riot] 404 not found: ${url}`);
        throw new NotFoundError(url, body);
      }

      if (response.status === 500 || response.status === 503) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new ApiError(`Riot API failed after retries (${response.status})`, response.status, url, body);
      }

      throw new ApiError(`Riot API request failed (${response.status})`, response.status, url, body);
    }

    throw new ApiError("Unexpected retry loop exit", 0, url);
  }

  async getMatchlist(puuid: string, region: string): Promise<MatchlistDto> {
    const url = new URL(
      `https://${getRegionalHost(region)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
    );
    url.searchParams.set("queue", "420");
    url.searchParams.set("type", "ranked");
    url.searchParams.set("count", "20");
    return this.fetch<MatchlistDto>(url.toString());
  }

  async getMatch(matchId: string, region: string): Promise<MatchDto> {
    const url = `https://${getRegionalHost(region)}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return this.fetch<MatchDto>(url);
  }

  async getTimeline(matchId: string, region: string): Promise<MatchTimelineDto> {
    const url = `https://${getRegionalHost(region)}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
    return this.fetch<MatchTimelineDto>(url);
  }

  async getRank(summonerId: string, region: string): Promise<RankDto | null> {
    const url = `https://${getPlatformHost(region)}/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
    const entries = await this.fetch<RankDto[]>(url);
    const solo = entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
    return solo ?? null;
  }
}
