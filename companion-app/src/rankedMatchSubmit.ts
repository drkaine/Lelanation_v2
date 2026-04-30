import { invoke } from "@tauri-apps/api/core";
import { regionToPlatformId } from "./regionPlatform";

const STORAGE_KEY = "lelanation-companion-submitted-match-ids";
/** Ranked Solo/Duo (classé solo/duo) — queue the user opted in to share for stats. */
const RANKED_SOLO_DUO_QUEUE = 420;

function loadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveIds(ids: Set<string>) {
  const arr = [...ids].slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function extractGames(raw: string): Array<{ gameId: number; queueId?: number }> {
  const j = JSON.parse(raw) as Record<string, unknown>;
  const g = j.games;
  let list: unknown[] = [];
  if (g && typeof g === "object" && "games" in g) {
    const inner = (g as { games?: unknown }).games;
    if (Array.isArray(inner)) list = inner;
  } else if (Array.isArray(g)) {
    list = g;
  } else if (Array.isArray(j)) {
    list = j;
  }
  const out: Array<{ gameId: number; queueId?: number }> = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const gameId = typeof o.gameId === "number" ? o.gameId : Number(o.gameId);
    const queueId = typeof o.queueId === "number" ? o.queueId : Number(o.queueId);
    if (!Number.isFinite(gameId)) continue;
    out.push({
      gameId,
      queueId: Number.isFinite(queueId) ? queueId : undefined,
    });
  }
  return out;
}

/**
 * When the user opted in, reads recent LCU match history and reserves Ranked Solo/Duo games on the server (no PII).
 */
export async function pollRankedSoloDuoAndSubmit(apiBase: string): Promise<void> {
  let summonerRaw: string;
  try {
    summonerRaw = await invoke<string>("lcu_request", {
      method: "GET",
      path: "/lol-summoner/v1/current-summoner",
      body: null,
    });
  } catch {
    return;
  }
  let puuid: string;
  try {
    const s = JSON.parse(summonerRaw) as { puuid?: string };
    puuid = typeof s.puuid === "string" ? s.puuid : "";
    if (!puuid) return;
  } catch {
    return;
  }
  let regionRaw: string;
  try {
    regionRaw = await invoke<string>("lcu_request", {
      method: "GET",
      path: "/riotclient/region-locale",
      body: null,
    });
  } catch {
    return;
  }
  let platform: string;
  try {
    const rl = JSON.parse(regionRaw) as { region?: string };
    platform = regionToPlatformId(rl.region);
  } catch {
    return;
  }
  let histRaw: string;
  try {
    const enc = encodeURIComponent(puuid);
    histRaw = await invoke<string>("lcu_request", {
      method: "GET",
      path: `/lol-match-history/v1/products/lol/${enc}/matches?begIndex=0&endIndex=20`,
      body: null,
    });
  } catch {
    return;
  }
  let games: Array<{ gameId: number; queueId?: number }>;
  try {
    games = extractGames(histRaw);
  } catch {
    return;
  }
  const known = loadIds();
  for (const g of games) {
    if (g.queueId !== RANKED_SOLO_DUO_QUEUE) continue;
    const matchId = `${platform}_${g.gameId}`;
    if (known.has(matchId)) continue;
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/app/submit-tracked-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      if (res.ok) {
        known.add(matchId);
      }
    } catch {
      /* offline */
    }
  }
  saveIds(known);
}
