const FAVORITES_KEY = "lelanation_favorite_build_ids";

export function getFavoriteIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function setFavoriteIds(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export function toggleFavorite(id: string): void {
  const ids = getFavoriteIds();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
  } else {
    ids.push(id);
  }
  setFavoriteIds(ids);
}

export function isFavorite(id: string): boolean {
  return getFavoriteIds().includes(id);
}
