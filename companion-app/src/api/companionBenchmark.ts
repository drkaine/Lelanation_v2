import { apiBase } from "../config";

export type CompanionBenchmark = {
  championId: number;
  patch: string | null;
  rankTier: string | null;
  role: string | null;
  games: number;
  metrics: Record<string, number | null>;
  avgDamageToChampions: number | null;
  winrate: number | null;
};

export async function fetchChampionBenchmark(params: {
  championId: number;
  patch?: string | null;
  rankTier?: string | null;
  role?: string | null;
}): Promise<CompanionBenchmark | null> {
  const q = new URLSearchParams();
  q.set("championId", String(params.championId));
  if (params.patch) q.set("patch", params.patch);
  if (params.rankTier) q.set("rankTier", params.rankTier);
  if (params.role) q.set("role", params.role);

  const url = `${apiBase.replace(/\/$/, "")}/api/app/companion/champion-benchmark?${q}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as CompanionBenchmark;
  } catch {
    return null;
  }
}
