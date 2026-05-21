import { config } from "../config/index.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { setGlobalRateLimitCooldown } from "../redis/rate-scheduler.js";
import { riotRoutingSummary, toPlatformHost, toRegionalHost } from "./hosts.js";
import type { MatchDto, MatchlistDto, MatchTimelineDto, RankDto, SummonerDto } from "./types.js";

export { riotRoutingSummary, toPlatformHost, toRegionalHost } from "./hosts.js";

const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

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

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : null;
  }
  return null;
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
      const startedAt = Date.now();
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Riot-Token": this.apiKey,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        pollerV2Observability.recordApiCall(response.status, Date.now() - startedAt);
        return (await response.json()) as T;
      }

      const body = await parseResponseBody(response);
      pollerV2Observability.recordApiCall(response.status, Date.now() - startedAt);

      if (response.status === 429) {
        const rateLimitType = response.headers.get("x-rate-limit-type") ?? "unknown";
        const minCooldownMs = rateLimitType === "application" ? 5000 : 1000;
        const retryAfterMs =
          parseRetryAfterMs(response.headers.get("retry-after")) ??
          Math.max(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 2000, 2000);
        const effectiveCooldownMs = Math.max(retryAfterMs, minCooldownMs);
        await setGlobalRateLimitCooldown(effectiveCooldownMs + 250);
        pollerV2Observability.recordApiRetry();
        pollerV2Observability.recordApiError(429, url);
        console.error(
          `[riot-alarm] 429 with limiter url=${url} retry_after_ms=${retryAfterMs} cooldown_ms=${effectiveCooldownMs} type=${rateLimitType}`,
        );
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(effectiveCooldownMs + 50);
          continue;
        }
        throw new RateLimitError(url, body);
      }

      if (response.status === 404) {
        pollerV2Observability.recordApiError(404, url);
        console.warn(`[riot] 404 not found: ${url}`);
        throw new NotFoundError(url, body);
      }

      if (response.status === 500 || response.status === 503) {
        if (attempt < RETRY_DELAYS_MS.length) {
          pollerV2Observability.recordApiRetry();
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        pollerV2Observability.recordApiError(response.status, url);
        throw new ApiError(`Riot API failed after retries (${response.status})`, response.status, url, body);
      }

      pollerV2Observability.recordApiError(response.status, url);
      throw new ApiError(`Riot API request failed (${response.status})`, response.status, url, body);
    }

    throw new ApiError("Unexpected retry loop exit", 0, url);
  }

  /** Match-v5 — regional host (europe), Ranked Solo/Duo only. */
  async getMatchIds(
    puuid: string,
    region: string,
    options?: {
      startTime?: number;
      start?: number;
    },
  ): Promise<MatchlistDto> {
    const url = new URL(
      `${toRegionalHost(region)}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids`,
    );
    url.searchParams.set("queue", "420");
    url.searchParams.set("type", "ranked");
    url.searchParams.set("count", "20");
    if (options?.startTime != null && Number.isFinite(options.startTime) && options.startTime > 0) {
      url.searchParams.set("startTime", String(Math.trunc(options.startTime)));
    }
    if (options?.start != null && Number.isFinite(options.start) && options.start >= 0) {
      url.searchParams.set("start", String(Math.trunc(options.start)));
    }
    return this.fetch<MatchlistDto>(url.toString());
  }

  /** @deprecated use getMatchIds */
  async getMatchlist(
    puuid: string,
    region: string,
    options?: { startTime?: number; start?: number },
  ): Promise<MatchlistDto> {
    return this.getMatchIds(puuid, region, options);
  }

  /** Match-v5 — regional host. */
  async getMatch(matchId: string, region: string): Promise<MatchDto> {
    const url = `${toRegionalHost(region)}/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return this.fetch<MatchDto>(url);
  }

  /** Match-v5 timeline — regional host. */
  async getMatchTimeline(matchId: string, region: string): Promise<MatchTimelineDto> {
    const url = `${toRegionalHost(region)}/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
    return this.fetch<MatchTimelineDto>(url);
  }

  /** @deprecated use getMatchTimeline */
  async getTimeline(matchId: string, region: string): Promise<MatchTimelineDto> {
    return this.getMatchTimeline(matchId, region);
  }

  /** League-v4 — platform host. */
  async getRank(puuid: string, region: string): Promise<RankDto | null> {
    const url = `${toPlatformHost(region)}/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
    try {
      const entries = await this.fetch<RankDto[]>(url);
      const solo =
        entries.find((entry) => String(entry.queueType ?? "").toUpperCase() === "RANKED_SOLO_5X5") ??
        entries.find((entry) => String(entry.queueType ?? "").toUpperCase().includes("RANKED_SOLO"));
      return solo ?? null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /** Summoner-v4 — platform host. */
  async getSummoner(puuid: string, region: string): Promise<SummonerDto> {
    const url = `${toPlatformHost(region)}/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
    return this.fetch<SummonerDto>(url);
  }
}

export function logRiotRoutingVerified(): void {
  console.log(`[riot] Routing verified: ${riotRoutingSummary()}`);
}
