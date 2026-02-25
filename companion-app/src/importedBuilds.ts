import type { StoredBuild } from "@lelanation/shared-types";

const KEY = "lelanation_imported_builds";

export function getImportedBuilds(): StoredBuild[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredBuild[];
  } catch {
    return [];
  }
}

export function setImportedBuilds(builds: StoredBuild[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(builds));
}

/**
 * Merge incoming builds with existing ones (deduplicates by id, newer wins).
 * Returns the count of newly added builds.
 */
export function mergeImportedBuilds(incoming: StoredBuild[]): number {
  const existing = getImportedBuilds();
  const byId = new Map(existing.map(b => [b.id, b]));
  let added = 0;
  for (const b of incoming) {
    if (!byId.has(b.id)) added++;
    byId.set(b.id, b);
  }
  setImportedBuilds(Array.from(byId.values()));
  return added;
}

export function removeImportedBuild(id: string): void {
  const builds = getImportedBuilds().filter(b => b.id !== id);
  setImportedBuilds(builds);
}

export function clearImportedBuilds(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}
