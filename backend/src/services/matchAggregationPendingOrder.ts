export type MatchAggregationPendingOrder = "oldest_first" | "newest_first";

/** Priorise les matchs récents (patch live) quand le backlog dépasse la cadence batch. */
export function getMatchAggregationPendingOrder(): MatchAggregationPendingOrder {
  const raw = process.env.MATCH_AGGREGATION_PENDING_ORDER?.trim().toLowerCase();
  if (raw === "oldest_first") return "oldest_first";
  return "newest_first";
}
