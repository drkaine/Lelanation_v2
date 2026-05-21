// Estimated API calls:
//   Apex: 2 regions × 3 tiers = 6 calls
//   Paginated: 2 regions × 5 tiers × 4 divisions × ~3 pages avg = 120 calls
//   Total: ~126 calls ≈ 160 seconds at 95 req/120s (throttled)
//
// Run ONCE before starting the poller, or weekly to refresh coverage.
// Stops lelanation-poller-v2 (PM2) for the duration if it is running, then restarts it.
// Discovery will naturally re-sort by last_seen once crawling begins.

const PM2_POLLER_APP = "lelanation-poller-v2";
const execFileAsync = promisify(execFile);

import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../src/config/index.js";
import { sql } from "../src/db/client.js";
import { isDatabaseConfigured } from "../src/db/query.js";
import { getPlatformHost } from "../src/riot/hosts.js";
import { normalizePlatformRegion } from "../src/riot/platform-region.js";

const QUEUE = "RANKED_SOLO_5x5";
const REGIONS = ["euw1", "eun1"] as const;
const APEX_TIERS = ["CHALLENGER", "GRANDMASTER", "MASTER"] as const;
const PAGINATED_TIERS = ["DIAMOND", "EMERALD", "PLATINUM", "GOLD", "SILVER"] as const;
const DIVISIONS = ["I", "II", "III", "IV"] as const;
const RIOT_PAGE_SIZE = 205;

/** Rough EUW+EUNE active Ranked Solo/Duo accounts (order of magnitude). */
const ESTIMATED_EU_ACTIVE_RANKED_SOLO = 2_400_000;

type LeagueEntry = {
  puuid?: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
};

type LeagueListResponse = {
  entries?: LeagueEntry[];
};

type SeedStats = {
  apiCalls: number;
  entriesProcessed: number;
  playersInserted: number;
  playersSkipped: number;
  rankSnapshotsInserted: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000] as const;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(status: number, attempt: number, retryAfterHeader: string | null): number {
  if (status === 429) {
    const retryAfterSec = Number.parseInt(retryAfterHeader ?? "2", 10);
    return Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 2000;
  }
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 8000;
}

function regionLabel(region: string): string {
  return normalizePlatformRegion(region).toUpperCase();
}

function throttleDelayMs(): number {
  return Math.ceil(120_000 / config.RATE_LIMIT_PER_120S);
}

async function throttle(): Promise<void> {
  await sleep(throttleDelayMs());
}

type Pm2AppStatus = "online" | "stopped" | "missing";

async function getPm2AppStatus(name: string): Promise<Pm2AppStatus> {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    const apps = JSON.parse(stdout) as Array<{ name?: string; pm2_env?: { status?: string } }>;
    const app = apps.find((entry) => entry.name === name);
    if (!app) return "missing";
    return app.pm2_env?.status === "online" ? "online" : "stopped";
  } catch {
    return "missing";
  }
}

async function stopPollerIfRunning(): Promise<boolean> {
  const status = await getPm2AppStatus(PM2_POLLER_APP);
  if (status !== "online") {
    console.log(`[seed] Poller not running under PM2 (${PM2_POLLER_APP} status=${status}) — continuing`);
    return false;
  }

  console.log(`[seed] Stopping ${PM2_POLLER_APP} for seed (avoids Riot rate-limit contention)...`);
  await execFileAsync("pm2", ["stop", PM2_POLLER_APP], { encoding: "utf8" });
  console.log(`[seed] ${PM2_POLLER_APP} stopped`);
  return true;
}

async function restartPoller(): Promise<void> {
  console.log(`[seed] Restarting ${PM2_POLLER_APP}...`);
  await execFileAsync("pm2", ["restart", PM2_POLLER_APP], { encoding: "utf8" });
  console.log(`[seed] ${PM2_POLLER_APP} restarted`);
}

async function riotGet<T>(url: string, retries = RETRY_DELAYS_MS.length): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Riot-Token": config.RIOT_API_KEY,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const body = await response.text();

    if (isRetryableStatus(response.status) && attempt < retries) {
      const waitMs = retryDelayMs(response.status, attempt, response.headers.get("retry-after"));
      console.warn(
        `[seed] ${response.status} on ${url} — waiting ${waitMs}ms before retry ${attempt + 1}/${retries}`,
      );
      await sleep(waitMs);
      continue;
    }

    throw new Error(`Riot API ${response.status} ${url}: ${body.slice(0, 200)}`);
  }

  throw new Error(`Riot API retry exhausted: ${url}`);
}

function normalizeRankDivision(value: string | null | undefined, fallback: string | null): string {
  const division = String(value ?? fallback ?? "I")
    .trim()
    .toUpperCase();
  return division.length > 0 ? division : "I";
}

function normalizeRankTier(entry: LeagueEntry, fallbackTier: string): string {
  return String(entry.tier ?? fallbackTier)
    .trim()
    .toUpperCase();
}

function clampRankLp(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(32767, Math.trunc(n)));
}

async function upsertLeagueEntries(
  entries: LeagueEntry[],
  region: string,
  tier: string,
  division: string | null,
  stats: SeedStats,
): Promise<void> {
  for (const entry of entries) {
    const puuid = String(entry.puuid ?? "").trim();
    if (!puuid) continue;

    stats.entriesProcessed += 1;

    const rankTier = normalizeRankTier(entry, tier);
    const rankDivision = normalizeRankDivision(entry.rank, division);
    const rankLp = clampRankLp(entry.leaguePoints);

    const insertedPlayer = await sql<{ puuid: string }[]>`
      INSERT INTO players (puuid, region, puuid_key_version, last_seen)
      VALUES (${puuid}, ${region}, ${config.PLAYER_KEY_VERSION}, NULL)
      ON CONFLICT (puuid) DO NOTHING
      RETURNING puuid
    `;
    if (insertedPlayer.length > 0) {
      stats.playersInserted += 1;
    } else {
      stats.playersSkipped += 1;
    }

    const insertedRank = await sql<{ puuid: string }[]>`
      INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
      VALUES (
        ${puuid},
        CURRENT_DATE,
        ${region},
        ${rankTier},
        ${rankDivision},
        ${rankLp}
      )
      ON CONFLICT (puuid, date, region) DO NOTHING
      RETURNING puuid
    `;
    if (insertedRank.length > 0) {
      stats.rankSnapshotsInserted += 1;
    }
  }
}

async function fetchApexLeague(
  region: string,
  tier: (typeof APEX_TIERS)[number],
  stats: SeedStats,
): Promise<LeagueEntry[]> {
  const host = getPlatformHost(region);
  const pathTier = tier.toLowerCase();
  const url = `https://${host}/lol/league/v4/${pathTier}leagues/by-queue/${QUEUE}`;
  stats.apiCalls += 1;
  const body = await riotGet<LeagueListResponse>(url);
  return body.entries ?? [];
}

async function fetchPaginatedLeaguePage(
  region: string,
  tier: string,
  division: string,
  page: number,
  stats: SeedStats,
): Promise<LeagueEntry[]> {
  const host = getPlatformHost(region);
  const url =
    `https://${host}/lol/league/v4/entries/${QUEUE}/${tier}/${division}?page=${page}`;
  stats.apiCalls += 1;
  return riotGet<LeagueEntry[]>(url);
}

async function seedApexTier(
  region: string,
  tier: (typeof APEX_TIERS)[number],
  stats: SeedStats,
): Promise<void> {
  await throttle();
  const entries = await fetchApexLeague(region, tier, stats);
  await upsertLeagueEntries(entries, region, tier, null, stats);
  console.log(
    `[seed] ${regionLabel(region)} ${tier} → ${entries.length} entries (total: ${stats.entriesProcessed})`,
  );
}

async function seedPaginatedTierDivision(
  region: string,
  tier: string,
  division: string,
  stats: SeedStats,
): Promise<void> {
  for (let page = 1; ; page += 1) {
    await throttle();
    const entries = await fetchPaginatedLeaguePage(region, tier, division, page, stats);
    await upsertLeagueEntries(entries, region, tier, division, stats);

    const label = regionLabel(region);
    if (entries.length < RIOT_PAGE_SIZE) {
      console.log(
        `[seed] ${label} ${tier} ${division} page ${page} → ${entries.length} entries — last page, moving on`,
      );
      break;
    }

    console.log(
      `[seed] ${label} ${tier} ${division} page ${page} → ${entries.length} entries (total: ${stats.entriesProcessed})`,
    );
  }
}

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL not set");
  }

  const stats: SeedStats = {
    apiCalls: 0,
    entriesProcessed: 0,
    playersInserted: 0,
    playersSkipped: 0,
    rankSnapshotsInserted: 0,
  };

  let pollerWasRunning = false;
  try {
    pollerWasRunning = await stopPollerIfRunning();

    console.log(
      `[seed] Starting EU player seed (regions=${REGIONS.join(",")}, throttle=${throttleDelayMs()}ms/call)`,
    );

    for (const region of REGIONS) {
      for (const tier of APEX_TIERS) {
        await seedApexTier(region, tier, stats);
      }

      for (const tier of PAGINATED_TIERS) {
        for (const division of DIVISIONS) {
          await seedPaginatedTierDivision(region, tier, division, stats);
        }
      }
    }

    const coveragePct = Math.min(
      100,
      Math.round((stats.entriesProcessed / ESTIMATED_EU_ACTIVE_RANKED_SOLO) * 1000) / 10,
    );

    console.log(
      `[seed] Done. ${stats.playersInserted} players inserted, ${stats.playersSkipped} skipped (already known).`,
    );
    console.log(
      `[seed] Estimated rank gate resolution: ~${coveragePct}% of current patch matches will resolve without a fresh rank fetch.`,
    );
    console.log(
      `[seed] Summary: ${stats.entriesProcessed} entries processed, ${stats.rankSnapshotsInserted} rank snapshots inserted, ${stats.apiCalls} API calls.`,
    );
  } finally {
    if (pollerWasRunning) {
      await restartPoller();
    }
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[seed] Fatal error:", error);
  process.exit(1);
});
