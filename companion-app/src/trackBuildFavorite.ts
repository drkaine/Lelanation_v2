import { apiBase } from "./config";

/** Fire-and-forget: count a build favorite add/remove. */
export function trackBuildFavorite(
  buildId: string | undefined,
  action: "add" | "remove",
): void {
  const id = buildId?.trim();
  if (!id) return;

  void fetch(`${apiBase}/api/builds/${encodeURIComponent(id)}/track-favorite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  }).catch(() => undefined);
}
