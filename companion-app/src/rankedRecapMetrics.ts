import type { MatchJournalEntry } from "./types/matchJournal";
import type { CompanionBenchmark } from "./api/companionBenchmark";

export type ComparisonRow = {
  id: string;
  labelKey: string;
  /** Player value from journal entry */
  playerValue(entry: MatchJournalEntry): number | null;
  /** DB benchmark average */
  benchmarkValue(benchmark: CompanionBenchmark): number | null;
  /** When true, negative delta is green (deaths) */
  lowerIsBetter?: boolean;
  /** Integer display (no decimals) */
  integer?: boolean;
};

export const RANKED_COMPARISON_ROWS: ComparisonRow[] = [
  {
    id: "kills",
    labelKey: "progression.recap.kills",
    playerValue: (e) => e.stats.kills ?? e.metrics.sum_kill_u15 ?? null,
    benchmarkValue: (b) => b.metrics.sum_kill_u15 ?? null,
    integer: true,
  },
  {
    id: "deaths",
    labelKey: "progression.recap.deaths",
    playerValue: (e) => e.stats.deaths ?? e.metrics.sum_death_u15 ?? null,
    benchmarkValue: (b) => b.metrics.sum_death_u15 ?? null,
    lowerIsBetter: true,
    integer: true,
  },
  {
    id: "assists",
    labelKey: "progression.recap.assists",
    playerValue: (e) => e.stats.assists ?? e.metrics.sum_assist_u15 ?? null,
    benchmarkValue: (b) => b.metrics.sum_assist_u15 ?? null,
    integer: true,
  },
  {
    id: "cs",
    labelKey: "progression.recap.cs",
    playerValue: (e) =>
      e.stats.csTotal ?? e.metrics.sum_minions_killed_u15 ?? null,
    benchmarkValue: (b) => b.metrics.sum_minions_killed_u15 ?? null,
    integer: true,
  },
  {
    id: "gold",
    labelKey: "progression.recap.gold",
    playerValue: (e) =>
      e.stats.goldEarned ?? e.metrics.sum_gold_earned ?? null,
    benchmarkValue: (b) => b.metrics.sum_gold_earned ?? null,
    integer: true,
  },
  {
    id: "damage",
    labelKey: "progression.recap.damage",
    playerValue: (e) =>
      e.stats.damageToChampions ??
      e.metrics.sum_damage_to_champions ??
      null,
    benchmarkValue: (b) => b.avgDamageToChampions,
    integer: true,
  },
  {
    id: "vision",
    labelKey: "progression.recap.vision",
    playerValue: (e) =>
      e.stats.visionScore ?? e.metrics.sum_vision_score_u15 ?? null,
    benchmarkValue: (b) => b.metrics.sum_vision_score_u15 ?? null,
    integer: true,
  },
];

export type TrendSeries = {
  id: string;
  labelKey: string;
  points: Array<{ playedAtMs: number; value: number }>;
  benchmark: number | null;
  lowerIsBetter?: boolean;
};

export function buildTrendSeries(
  entries: MatchJournalEntry[],
  benchmark: CompanionBenchmark | null,
): TrendSeries[] {
  const chronological = [...entries].sort((a, b) => a.playedAtMs - b.playedAtMs);

  return RANKED_COMPARISON_ROWS.filter((r) =>
    ["kills", "deaths", "cs", "damage"].includes(r.id),
  ).map((row) => ({
    id: row.id,
    labelKey: row.labelKey,
    lowerIsBetter: row.lowerIsBetter,
    benchmark: benchmark ? row.benchmarkValue(benchmark) : null,
    points: chronological
      .map((entry) => {
        const v = row.playerValue(entry);
        return v != null ? { playedAtMs: entry.playedAtMs, value: v } : null;
      })
      .filter((p): p is { playedAtMs: number; value: number } => p != null),
  }));
}

export function formatDelta(
  player: number | null,
  bench: number | null,
): { text: string; positive: boolean | null } {
  if (player == null || bench == null || Number.isNaN(player) || Number.isNaN(bench)) {
    return { text: "—", positive: null };
  }
  const d = player - bench;
  const sign = d > 0 ? "+" : "";
  return { text: `${sign}${d.toFixed(1)}`, positive: d > 0 ? true : d < 0 ? false : null };
}
