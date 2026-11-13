import type { JunglePathResult } from "../parsers/junglePathExtract.js";

/** Premier clear d'un joueur jungle (path reconstruit, null si illisible). */
export type JunglePathGameRow = { teamId: number; win: boolean; path: JunglePathResult | null };

export type JunglePathStat = {
  pathSequence: string[];
  pathHash: string;
  games: number;
  wins: number;
  winrate: number;
  /** Part des parties du côté. */
  share: number;
  avgClearTimeMs: number | null;
};

export type JungleStartStat = { camp: string; games: number; share: number };

export type JungleSideStats = {
  teamId: number;
  games: number;
  starts: JungleStartStat[];
  paths: JunglePathStat[];
};

export type JunglePathsAggregate = { sides: JungleSideStats[] };

/** Un clear compte comme « path » à partir de 3 camps ; en dessous, seul le départ est compté. */
const MIN_PATH_CAMPS = 3;

/** `blue_buff_red` → `blue_buff`, `scuttler_top` → `scuttler`. */
function campType(key: string): string {
  return key.startsWith("scuttler") ? "scuttler" : key.replace(/_(blue|red)$/, "");
}

/** Stats op.gg-like : par côté, départs et top N des premiers clears. */
export function aggregateJunglePaths(
  rows: JunglePathGameRow[],
  opts: { top: number },
): JunglePathsAggregate {
  const bySide = new Map<number, JunglePathGameRow[]>();
  for (const r of rows) {
    if (!r.path?.pathSequence.length) continue;
    const list = bySide.get(r.teamId) ?? [];
    list.push(r);
    bySide.set(r.teamId, list);
  }

  const sides = [...bySide.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamId, list]): JungleSideStats => {
      const games = list.length;
      const starts = new Map<string, number>();
      const paths = new Map<string, { seq: string[]; games: number; wins: number; clearSum: number; clearN: number }>();
      for (const r of list) {
        const seq = r.path!.pathSequence;
        const start = campType(seq[0]!);
        starts.set(start, (starts.get(start) ?? 0) + 1);
        if (seq.length < MIN_PATH_CAMPS) continue;
        const p = paths.get(r.path!.pathHash) ?? { seq, games: 0, wins: 0, clearSum: 0, clearN: 0 };
        p.games++;
        if (r.win) p.wins++;
        if (r.path!.clearTimeMs != null) {
          p.clearSum += r.path!.clearTimeMs;
          p.clearN++;
        }
        paths.set(r.path!.pathHash, p);
      }
      return {
        teamId,
        games,
        starts: [...starts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([camp, n]) => ({ camp, games: n, share: n / games })),
        paths: [...paths.entries()]
          .sort((a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins)
          .slice(0, opts.top)
          .map(([hash, p]) => ({
            pathSequence: p.seq,
            pathHash: hash,
            games: p.games,
            wins: p.wins,
            winrate: p.wins / p.games,
            share: p.games / games,
            avgClearTimeMs: p.clearN ? Math.round(p.clearSum / p.clearN) : null,
          })),
      };
    });

  return { sides };
}
