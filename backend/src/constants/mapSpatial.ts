/** LoL map spatial constants (15000×15000). */

export const MAP_SIZE = 15_000;

export const CAMP_POSITIONS: Record<string, { x: number; y: number }> = {
  blue_buff_blue: { x: 3800, y: 7800 },
  red_buff_blue: { x: 7800, y: 3900 },
  gromp_blue: { x: 2800, y: 8600 },
  wolves_blue: { x: 3300, y: 6300 },
  raptors_blue: { x: 6700, y: 2900 },
  krugs_blue: { x: 8200, y: 2300 },
  blue_buff_red: { x: 11200, y: 7200 },
  red_buff_red: { x: 7200, y: 11100 },
  gromp_red: { x: 12200, y: 6400 },
  wolves_red: { x: 11700, y: 8700 },
  raptors_red: { x: 8300, y: 12100 },
  krugs_red: { x: 6800, y: 12700 },
  scuttler_blue: { x: 4100, y: 4100 },
  scuttler_red: { x: 11900, y: 4100 },
  dragon: { x: 9900, y: 4600 },
  baron: { x: 4900, y: 10400 },
};

export const EARLY_JUNGLE_PATH_MS = 360_000;
/** Fenêtre max pour le premier cycle complet (jusqu'au scuttler ou 10 min). */
export const FIRST_JUNGLE_CLEAR_MAX_MS = 600_000;
export const MAX_JUNGLE_PATH_CAMPS = 8;

/** Camps inclus dans une séquence de path jungle (hors dragon/baron/herald). */
export const NEUTRAL_JUNGLE_PATH_CAMP_TYPES = new Set([
  "blue",
  "red",
  "gromp",
  "wolves",
  "raptors",
  "krugs",
  "scuttler",
]);

export function isNeutralJunglePathCamp(campType: string): boolean {
  return NEUTRAL_JUNGLE_PATH_CAMP_TYPES.has(String(campType ?? "").trim().toLowerCase());
}

/** Strip `_blue` / `_red` camp suffix for display grouping. */
export function normalizeCampName(campKey: string): string {
  const v = String(campKey ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  return v.replace(/_(blue|red)$/, "");
}

const CAMP_ALIAS: Record<string, string> = {
  blue: "blue_buff",
  red: "red_buff",
  gromp: "gromp",
  wolves: "wolves",
  raptors: "raptors",
  krugs: "krugs",
  scuttler: "scuttler",
  dragon: "dragon",
  baron: "baron",
};

/** Nom de séquence incluant le côté (`blue_buff_blue` vs `blue_buff_red`). */
export function campKeyToSequenceName(campKey: string): string {
  const key = String(campKey ?? "").trim().toLowerCase();
  if (!key) return "unknown";
  if (key.endsWith("_blue") || key.endsWith("_red")) return key;
  return campTypeToSequenceName(key);
}

export function campTypeToSequenceName(raw: string): string {
  const key = String(raw ?? "").trim().toLowerCase();
  if (CAMP_ALIAS[key]) return CAMP_ALIAS[key]!;
  return normalizeCampName(key);
}

/** Rayon max (unités carte) pour associer une position à un camp neutre. */
export const NEUTRAL_CAMP_SNAP_RADIUS = 2_200;

const NEUTRAL_CAMP_POSITION_KEYS = Object.keys(CAMP_POSITIONS).filter(
  (k) => k !== "dragon" && k !== "baron",
);

/** Clé `CAMP_POSITIONS` → type court (`blue`, `gromp`, …) pour `jungle_camp_history`. */
export function campPositionKeyToCampType(key: string): string {
  const base = normalizeCampName(key);
  if (base === "blue_buff") return "blue";
  if (base === "red_buff") return "red";
  return base;
}

export function nearestNeutralCampKey(x: number, y: number): string | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || (x <= 0 && y <= 0)) return null;
  let bestKey: string | null = null;
  let bestDist = Infinity;
  for (const key of NEUTRAL_CAMP_POSITION_KEYS) {
    const pos = CAMP_POSITIONS[key]!;
    const dist = Math.hypot(x - pos.x, y - pos.y);
    if (dist <= NEUTRAL_CAMP_SNAP_RADIUS && dist < bestDist) {
      bestDist = dist;
      bestKey = key;
    }
  }
  return bestKey;
}

export function nearestNeutralCamp(x: number, y: number): string | null {
  const key = nearestNeutralCampKey(x, y);
  return key ? campPositionKeyToCampType(key) : null;
}
