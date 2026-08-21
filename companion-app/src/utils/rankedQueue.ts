/** Ranked Solo/Duo queue id (League client). */
export const RANKED_SOLO_DUO_QUEUE_ID = 420;

export function isRankedSoloDuo(entry: {
  queueId?: number | null;
  queueType?: string;
  ranked?: boolean;
}): boolean {
  if (entry.queueId === RANKED_SOLO_DUO_QUEUE_ID) return true;
  const qt = (entry.queueType ?? "").toUpperCase();
  return qt === "RANKED_SOLO_5x5" || (entry.ranked === true && qt.includes("RANKED_SOLO"));
}
