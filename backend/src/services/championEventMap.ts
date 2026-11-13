import { getLaneZone, positionToZone } from "../constants/map.js";

/** Contexte d'un kill du champion : gank (jungler en lane), roam (laner hors de sa lane), lane, jungle, late (≥ 20 min). */
export type EventMapKillKind = "gank" | "roam" | "lane" | "jungle" | "late";
export type EventMapWardKind = "trinket" | "control" | "farsight" | "ward";

/** Points compacts : [x, y, secondes de jeu, catégorie?]. Coordonnées Riot (0–~15000, origine en bas à gauche). */
export type EventMapKillPoint = [number, number, number, EventMapKillKind];
export type EventMapPoint = [number, number, number];
export type EventMapWardPoint = [number, number, number, EventMapWardKind];

export type ChampionEventMap = {
  games: number;
  kills: EventMapKillPoint[];
  deaths: EventMapPoint[];
  wardsPlaced: EventMapWardPoint[];
  wardsKilled: EventMapWardPoint[];
};

export type ChampionEventMapRow = {
  team_position: string | null;
  kill_history?: unknown;
  death_history?: unknown;
  ward_history?: unknown;
  ward_killed_history?: unknown;
};

const LATE_MS = 1_200_000;

type HistoryEntry = { timestamp_ms: number; position: { x: number; y: number }; ward_type?: string };

export function classifyKill(
  kill: { position: { x: number; y: number }; timestamp_ms: number },
  teamPosition: string | null,
): EventMapKillKind {
  if (kill.timestamp_ms >= LATE_MS) return "late";
  const zone = getLaneZone(kill.position.x, kill.position.y);
  if (zone === "JUNGLE") return "jungle";
  if (teamPosition === "JUNGLE") return "gank";
  const own = positionToZone(teamPosition ?? "");
  return own === null || own === zone ? "lane" : "roam";
}

function wardKind(type: string | undefined): EventMapWardKind {
  switch (String(type ?? "").toUpperCase()) {
    case "YELLOW_TRINKET":
      return "trinket";
    case "CONTROL_WARD":
      return "control";
    case "BLUE_TRINKET":
      return "farsight";
    default:
      return "ward";
  }
}

function entries(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryEntry[] = [];
  for (const e of raw) {
    const ts = Number((e as HistoryEntry)?.timestamp_ms);
    const x = Math.trunc(Number((e as HistoryEntry)?.position?.x));
    const y = Math.trunc(Number((e as HistoryEntry)?.position?.y));
    if (!Number.isFinite(ts) || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x <= 0 && y <= 0) continue;
    out.push({ timestamp_ms: ts, position: { x, y }, ward_type: (e as HistoryEntry).ward_type });
  }
  return out;
}

const sec = (ms: number): number => Math.floor(ms / 1000);

export function buildChampionEventMap(rows: ChampionEventMapRow[]): ChampionEventMap {
  const map: ChampionEventMap = {
    games: rows.length,
    kills: [],
    deaths: [],
    wardsPlaced: [],
    wardsKilled: [],
  };
  for (const row of rows) {
    for (const k of entries(row.kill_history)) {
      map.kills.push([k.position.x, k.position.y, sec(k.timestamp_ms), classifyKill(k, row.team_position)]);
    }
    for (const d of entries(row.death_history)) {
      map.deaths.push([d.position.x, d.position.y, sec(d.timestamp_ms)]);
    }
    for (const w of entries(row.ward_history)) {
      map.wardsPlaced.push([w.position.x, w.position.y, sec(w.timestamp_ms), wardKind(w.ward_type)]);
    }
    for (const w of entries(row.ward_killed_history)) {
      map.wardsKilled.push([w.position.x, w.position.y, sec(w.timestamp_ms), wardKind(w.ward_type)]);
    }
  }
  return map;
}
