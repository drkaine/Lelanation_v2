import { getLaneZone, nearTeamTurret, positionToZone } from "../constants/map.js";

/** Contexte d'un kill du champion : gank (jungler en lane), roam (laner hors de sa lane), lane, jungle, late (≥ 20 min). */
export type EventMapKillKind = "dive" | "gank" | "roam" | "lane" | "jungle" | "late";
/** Contexte d'une mort : dive (sous sa tour), gank (jungler adverse), roam (laner adverse hors lane), solo (1v1), fight (plusieurs adversaires), other (tour, sbires…). */
export type EventMapDeathKind = "dive" | "gank" | "roam" | "solo" | "fight" | "other";
export type EventMapWardKind = "trinket" | "control" | "farsight" | "ward";

/** Points compacts : [x, y, secondes de jeu, catégorie?]. Coordonnées Riot (0–~15000, origine en bas à gauche). */
export type EventMapKillPoint = [number, number, number, EventMapKillKind];
export type EventMapDeathPoint = [number, number, number, EventMapDeathKind];
export type EventMapWardPoint = [number, number, number, EventMapWardKind];

export type ChampionEventMap = {
  games: number;
  kills: EventMapKillPoint[];
  deaths: EventMapDeathPoint[];
  wardsPlaced: EventMapWardPoint[];
  wardsKilled: EventMapWardPoint[];
};

/** Adversaire du match : rôle et instants (ms) de ses assists. */
export type EventMapEnemyRow = { id: number; position: string | null; assists: unknown };

export type ChampionEventMapRow = {
  team_id?: number | null;
  team_position: string | null;
  enemies?: EventMapEnemyRow[] | null;
  kill_history?: unknown;
  death_history?: unknown;
  ward_history?: unknown;
  ward_killed_history?: unknown;
};

const LATE_MS = 1_200_000;

type HistoryEntry = {
  timestamp_ms: number;
  position: { x: number; y: number };
  ward_type?: string;
  death_by?: number;
};

export function classifyKill(
  kill: { position: { x: number; y: number }; timestamp_ms: number },
  teamPosition: string | null,
  teamId?: number | null,
): EventMapKillKind {
  if (teamId === 100 || teamId === 200) {
    if (nearTeamTurret(kill.position.x, kill.position.y, teamId === 100 ? 200 : 100)) return "dive";
  }
  if (kill.timestamp_ms >= LATE_MS) return "late";
  const zone = getLaneZone(kill.position.x, kill.position.y);
  if (zone === "JUNGLE") return "jungle";
  if (teamPosition === "JUNGLE") return "gank";
  const own = positionToZone(teamPosition ?? "");
  return own === null || own === zone ? "lane" : "roam";
}

export type DeathContext = {
  teamId: number | null;
  teamPosition: string | null;
  enemies: Map<number, { position: string | null; assists: Set<number> }>;
};

/**
 * Riot ne stocke pas les assists sur la mort : on les retrouve dans l'`assist_history` des adversaires
 * (même instant). Un assist isolé n'y laisse pas de trace : un 2v1 peut ressortir en « solo ».
 */
export function classifyDeath(
  death: { position: { x: number; y: number }; timestamp_ms: number; death_by?: number },
  ctx: DeathContext,
): EventMapDeathKind {
  const killer = ctx.enemies.get(Number(death.death_by));
  if (!killer) return "other";
  const { x, y } = death.position;
  if ((ctx.teamId === 100 || ctx.teamId === 200) && nearTeamTurret(x, y, ctx.teamId)) return "dive";
  const helpers = [...ctx.enemies.entries()].filter(
    ([id, e]) => id !== Number(death.death_by) && e.assists.has(death.timestamp_ms),
  );
  const zone = getLaneZone(x, y);
  const early = death.timestamp_ms < LATE_MS;
  if (early && zone !== "JUNGLE" && ctx.teamPosition !== "JUNGLE") {
    if (killer.position === "JUNGLE" || helpers.some(([, e]) => e.position === "JUNGLE")) return "gank";
    const killerLane = positionToZone(killer.position ?? "");
    if (killerLane !== null && killerLane !== zone) return "roam";
  }
  return helpers.length ? "fight" : "solo";
}

function enemyMap(raw: EventMapEnemyRow[] | null | undefined): DeathContext["enemies"] {
  const out: DeathContext["enemies"] = new Map();
  for (const e of Array.isArray(raw) ? raw : []) {
    const assists = new Set<number>(
      (Array.isArray(e.assists) ? e.assists : []).map(Number).filter(Number.isFinite),
    );
    out.set(Number(e.id), { position: e.position ?? null, assists });
  }
  return out;
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
    out.push({
      timestamp_ms: ts,
      position: { x, y },
      ward_type: (e as HistoryEntry).ward_type,
      death_by: (e as HistoryEntry).death_by,
    });
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
    const teamId = row.team_id ?? null;
    for (const k of entries(row.kill_history)) {
      map.kills.push([
        k.position.x,
        k.position.y,
        sec(k.timestamp_ms),
        classifyKill(k, row.team_position, teamId),
      ]);
    }
    const ctx: DeathContext = { teamId, teamPosition: row.team_position, enemies: enemyMap(row.enemies) };
    for (const d of entries(row.death_history)) {
      map.deaths.push([d.position.x, d.position.y, sec(d.timestamp_ms), classifyDeath(d, ctx)]);
    }
    for (const w of entries(row.ward_history)) {
      map.wardsPlaced.push([w.position.x, w.position.y, sec(w.timestamp_ms), wardKind(w.ward_type)]);
    }
    for (const w of entries(row.ward_killed_history)) {
      map.wardsKilled.push([w.position.x, w.position.y, sec(w.timestamp_ms), wardKind(w.ward_type)]);
    }
  }
  map.kills = samplePoints(map.kills, MAX_POINTS_PER_LAYER);
  map.deaths = samplePoints(map.deaths, MAX_POINTS_PER_LAYER);
  map.wardsPlaced = samplePoints(map.wardsPlaced, MAX_POINTS_PER_LAYER);
  map.wardsKilled = samplePoints(map.wardsKilled, MAX_POINTS_PER_LAYER);
  return map;
}

/** Points max par couche envoyés au front (lisibilité + poids de la réponse). */
const MAX_POINTS_PER_LAYER = 4_000;

/** Sous-échantillon régulier (1 point sur n) de `max` éléments au plus. */
export function samplePoints<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, i) => items[Math.floor(i * step)]!);
}

/** Nombre max de parties lues : null = toutes les parties du champion sur le patch. */
export function eventMapGameLimit(games: number | null | undefined): number | null {
  if (games == null || !Number.isFinite(games)) return null;
  return Math.min(Math.max(Math.trunc(games), 1), 20_000);
}
