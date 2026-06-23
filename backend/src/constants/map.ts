/**
 * Summoner's Rift map constants for timeline event classification.
 * Tower coordinates are approximate — verify against in-game data if detection accuracy needs tuning.
 */

export const TOWER_AGGRO_RADIUS = 850;

export const LANE_ZONES = {
  TOP: { minX: 0, maxX: 5500, minY: 9000, maxY: 15000 },
  BOTTOM: { minX: 9000, maxX: 15000, minY: 0, maxY: 5500 },
  MIDDLE: { minX: 3500, maxX: 11500, minY: 3500, maxY: 11500 },
} as const;

export type LaneZone = "TOP" | "MIDDLE" | "BOTTOM" | "JUNGLE";

export function getLaneZone(x: number, y: number): LaneZone {
  if (x < 5500 && y > 9000) return "TOP";
  if (x > 9000 && y < 5500) return "BOTTOM";
  if (Math.abs(x - y) < 3500 && x > 3500 && x < 11500) return "MIDDLE";
  return "JUNGLE";
}

export function positionToZone(pos: string): LaneZone | null {
  switch (pos) {
    case "TOP":
      return "TOP";
    case "MIDDLE":
      return "MIDDLE";
    case "BOTTOM":
    case "UTILITY":
      return "BOTTOM";
    default:
      return null;
  }
}

export interface TowerPosition {
  teamId: 100 | 200;
  lane: "TOP" | "MIDDLE" | "BOTTOM" | "NEXUS";
  tier: "OUTER" | "INNER" | "INHIBITOR" | "NEXUS";
  x: number;
  y: number;
}

export const INITIAL_TOWERS: TowerPosition[] = [
  { teamId: 100, lane: "TOP", tier: "OUTER", x: 1250, y: 13600 },
  { teamId: 100, lane: "TOP", tier: "INNER", x: 1450, y: 10450 },
  { teamId: 100, lane: "TOP", tier: "INHIBITOR", x: 1000, y: 8500 },
  { teamId: 100, lane: "MIDDLE", tier: "OUTER", x: 5700, y: 9250 },
  { teamId: 100, lane: "MIDDLE", tier: "INNER", x: 4800, y: 7600 },
  { teamId: 100, lane: "MIDDLE", tier: "INHIBITOR", x: 3700, y: 7650 },
  { teamId: 100, lane: "BOTTOM", tier: "OUTER", x: 10500, y: 1400 },
  { teamId: 100, lane: "BOTTOM", tier: "INNER", x: 8800, y: 1800 },
  { teamId: 100, lane: "BOTTOM", tier: "INHIBITOR", x: 8900, y: 2850 },
  { teamId: 100, lane: "NEXUS", tier: "NEXUS", x: 1600, y: 2200 },
  { teamId: 100, lane: "NEXUS", tier: "NEXUS", x: 2200, y: 1500 },
  { teamId: 200, lane: "TOP", tier: "OUTER", x: 4300, y: 13900 },
  { teamId: 200, lane: "TOP", tier: "INNER", x: 6100, y: 13900 },
  { teamId: 200, lane: "TOP", tier: "INHIBITOR", x: 7000, y: 13400 },
  { teamId: 200, lane: "MIDDLE", tier: "OUTER", x: 9200, y: 5700 },
  { teamId: 200, lane: "MIDDLE", tier: "INNER", x: 10000, y: 8000 },
  { teamId: 200, lane: "MIDDLE", tier: "INHIBITOR", x: 11000, y: 7800 },
  { teamId: 200, lane: "BOTTOM", tier: "OUTER", x: 13800, y: 10400 },
  { teamId: 200, lane: "BOTTOM", tier: "INNER", x: 13400, y: 8600 },
  { teamId: 200, lane: "BOTTOM", tier: "INHIBITOR", x: 13100, y: 7400 },
  { teamId: 200, lane: "NEXUS", tier: "NEXUS", x: 13300, y: 11900 },
  { teamId: 200, lane: "NEXUS", tier: "NEXUS", x: 11800, y: 13200 },
];
