import { CAMP_POSITIONS } from "../constants/mapSpatial.js";
import type { JungleCampEntry } from "./junglePathExtract.js";

/**
 * La timeline Riot n'a qu'une position par minute : on ne voit qu'environ 1 camp par minute,
 * alors qu'un full clear (6 camps) tient en ~2 min. On reconstruit le clear probable :
 * camps observés (ordre et instant) + rythme moyen + trajet le plus court entre camps.
 */

/** Apparition des camps (1:30). */
const CAMP_SPAWN_MS = 90_000;
/** Durée moyenne d'un camp, trajet compris. */
const CAMP_STEP_MS = 22_000;
/** Au-delà, l'observation ne fait plus partie du premier clear. */
const FIRST_CLEAR_WINDOW_MS = 270_000;
/** Crabe gardé après le clear s'il est pris avant. */
const SCUTTLE_WINDOW_MS = 330_000;
const SHORT_CLEAR_CAMPS = 3;
const FULL_CLEAR_CAMPS = 6;
const ORDER_PENALTY = 4_000;

const OWN_CAMP_BASES = ["blue_buff", "gromp", "wolves", "red_buff", "raptors", "krugs"];

type Side = "blue" | "red";

function sideOf(key: string): Side | null {
  return key.endsWith("_blue") ? "blue" : key.endsWith("_red") ? "red" : null;
}

function isScuttle(key: string): boolean {
  return key.startsWith("scuttler");
}

function dist(a: string, b: string): number {
  const pa = CAMP_POSITIONS[a];
  const pb = CAMP_POSITIONS[b];
  if (!pa || !pb) return 0;
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

function estimatedIndex(ts: number): number {
  return Math.max(0, Math.min(FULL_CLEAR_CAMPS - 1, Math.floor((ts - CAMP_SPAWN_MS) / CAMP_STEP_MS)));
}

/** Toutes les suites ordonnées de `size` éléments pris dans `items`. */
function* arrangements(items: string[], size: number, prefix: string[] = []): Generator<string[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (const it of items) {
    if (!prefix.includes(it)) yield* arrangements(items, size, [...prefix, it]);
  }
}

export function reconstructFirstClear(camps: JungleCampEntry[]): JungleCampEntry[] | null {
  const keyed = [...camps]
    .filter((c) => c.camp_key && c.timestamp_ms <= SCUTTLE_WINDOW_MS)
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

  const first = keyed.find(
    (c) => c.timestamp_ms <= FIRST_CLEAR_WINDOW_MS && !isScuttle(c.camp_key!) && sideOf(c.camp_key!),
  );
  if (!first) return null;
  const side = sideOf(first.camp_key!)!;

  // Ancres : camps de son côté vus pendant le premier clear, jusqu'à la première sortie.
  const anchors: { key: string; ts: number; idx: number }[] = [];
  let exitTs = Infinity;
  for (const c of keyed) {
    const key = c.camp_key!;
    if (c.timestamp_ms < first.timestamp_ms) continue;
    if (c.timestamp_ms > FIRST_CLEAR_WINDOW_MS || isScuttle(key) || sideOf(key) !== side) {
      exitTs = c.timestamp_ms;
      break;
    }
    if (anchors.some((a) => a.key === key)) continue;
    const prev = anchors[anchors.length - 1];
    const idx = Math.max(estimatedIndex(c.timestamp_ms), prev ? prev.idx + 1 : 0);
    if (idx >= FULL_CLEAR_CAMPS) break;
    anchors.push({ key, ts: c.timestamp_ms, idx });
  }

  const lastIdx = anchors[anchors.length - 1]!.idx;
  const size =
    lastIdx >= FULL_CLEAR_CAMPS - 2
      ? FULL_CLEAR_CAMPS
      : Math.max(SHORT_CLEAR_CAMPS, anchors.length, lastIdx + 1);

  const own = OWN_CAMP_BASES.map((b) => `${b}_${side}`);
  let best: string[] | null = null;
  let bestCost = Infinity;
  for (const seq of arrangements(own, size)) {
    let pos = -1;
    let cost = 0;
    let ok = true;
    for (const a of anchors) {
      const p = seq.indexOf(a.key);
      if (p <= pos) {
        ok = false;
        break;
      }
      pos = p;
      cost += Math.abs(p - a.idx) * ORDER_PENALTY;
    }
    if (!ok) continue;
    for (let i = 1; i < seq.length; i++) cost += dist(seq[i - 1]!, seq[i]!);
    if (cost < bestCost) {
      bestCost = cost;
      best = [...seq];
    }
  }
  if (!best) return null;

  const anchorTs = new Map(anchors.map((a) => [a.key, a.ts]));
  const out: JungleCampEntry[] = [];
  let lastTs = 0;
  for (let i = 0; i < best.length; i++) {
    const key = best[i]!;
    const estimate = CAMP_SPAWN_MS + (i + 1) * CAMP_STEP_MS;
    const ts = Math.max(lastTs + 1, anchorTs.get(key) ?? estimate);
    out.push({ camp_type: campTypeOf(key), camp_key: key, timestamp_ms: ts });
    lastTs = ts;
  }

  const scuttle = keyed.find(
    (c) => isScuttle(c.camp_key!) && c.timestamp_ms >= Math.min(exitTs, lastTs),
  );
  if (scuttle) {
    out.push({ ...scuttle, timestamp_ms: Math.max(lastTs + 1, scuttle.timestamp_ms) });
  }
  return out;
}

function campTypeOf(key: string): string {
  const base = key.replace(/_(blue|red)$/, "");
  if (base === "blue_buff") return "blue";
  if (base === "red_buff") return "red";
  return base;
}
