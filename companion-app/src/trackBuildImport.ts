import { apiBase } from "./config";

/** Fire-and-forget: count a successful companion → LoL client import. */
export function trackBuildAppImport(buildId: string | undefined): void {
  const id = buildId?.trim();
  if (!id) return;

  void fetch(`${apiBase}/api/builds/${encodeURIComponent(id)}/track-import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }).catch(() => undefined);
}
