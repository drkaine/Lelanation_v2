import { createHash } from "node:crypto";
import {
  campTypeToSequenceName,
  EARLY_JUNGLE_PATH_MS,
  isNeutralJunglePathCamp,
  MAX_JUNGLE_PATH_CAMPS,
} from "../constants/mapSpatial.js";

export type JungleCampEntry = {
  camp_type: string;
  timestamp_ms: number;
};

export type JungleEarlyPath = {
  path_sequence: string[];
  path_hash: string;
  clear_time_ms: number | null;
};

/** Document JSONB stocké dans `participants.jungle_camp_history`. */
export type JungleCampHistoryDoc = {
  camps: JungleCampEntry[];
  early_path?: JungleEarlyPath | null;
};

export type JunglePathResult = {
  pathSequence: string[];
  pathHash: string;
  clearTimeMs: number | null;
};

function parseJsonValue(raw: unknown): unknown {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
      if (typeof data === "string") data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
}

export function isJungleCampHistoryDoc(value: unknown): value is JungleCampHistoryDoc {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Array.isArray((value as JungleCampHistoryDoc).camps);
}

export function parseCampHistory(raw: unknown): JungleCampEntry[] {
  const data = parseJsonValue(raw);
  if (!data) return [];

  const rows = isJungleCampHistoryDoc(data) ? data.camps : Array.isArray(data) ? data : [];
  const out: JungleCampEntry[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const camp = String((row as JungleCampEntry).camp_type ?? "").trim();
    const ts = Number((row as JungleCampEntry).timestamp_ms ?? 0);
    if (!camp || !Number.isFinite(ts)) continue;
    out.push({ camp_type: camp, timestamp_ms: Math.trunc(ts) });
  }

  return out.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}

export function readEarlyPath(raw: unknown): JunglePathResult | null {
  const data = parseJsonValue(raw);
  if (data && isJungleCampHistoryDoc(data) && data.early_path?.path_hash) {
    const ep = data.early_path;
    return {
      pathSequence: ep.path_sequence ?? [],
      pathHash: ep.path_hash,
      clearTimeMs: ep.clear_time_ms ?? null,
    };
  }
  return extractJunglePathFromCamps(parseCampHistory(raw));
}

export function extractJunglePathFromCamps(camps: JungleCampEntry[]): JunglePathResult | null {
  const early = camps
    .filter((c) => c.timestamp_ms < EARLY_JUNGLE_PATH_MS)
    .filter((c) => isNeutralJunglePathCamp(c.camp_type))
    .slice(0, MAX_JUNGLE_PATH_CAMPS);

  if (early.length === 0) return null;

  const pathSequence = early.map((c) => campTypeToSequenceName(c.camp_type));
  const pathHash = createHash("md5").update(pathSequence.join(",")).digest("hex");
  const clearTimeMs = early[early.length - 1]?.timestamp_ms ?? null;

  return { pathSequence, pathHash, clearTimeMs };
}

/** Accepte array legacy ou document `{ camps, early_path }`. */
export function extractJunglePath(jungleCampHistory: unknown): JunglePathResult | null {
  return readEarlyPath(jungleCampHistory);
}

export function toJungleCampHistoryDoc(
  camps: JungleCampEntry[],
  computeEarlyPath: boolean,
): JungleCampHistoryDoc {
  const sorted = [...camps].sort((a, b) => a.timestamp_ms - b.timestamp_ms);
  const doc: JungleCampHistoryDoc = { camps: sorted };

  if (computeEarlyPath) {
    const path = extractJunglePathFromCamps(sorted);
    if (path) {
      doc.early_path = {
        path_sequence: path.pathSequence,
        path_hash: path.pathHash,
        clear_time_ms: path.clearTimeMs,
      };
    }
  }

  return doc;
}
