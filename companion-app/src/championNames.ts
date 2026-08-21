import type { Champion } from "@lelanation/shared-types";
import { apiBase } from "./config";

const cacheByLang = new Map<string, Map<number, string>>();

function riotLang(language: "fr" | "en"): string {
  return language === "en" ? "en_US" : "fr_FR";
}

/** Numeric champion id (Riot key) → localized display name. */
export async function loadChampionNameMap(language: "fr" | "en"): Promise<Map<number, string>> {
  const lang = riotLang(language);
  const cached = cacheByLang.get(lang);
  if (cached) return cached;

  const map = new Map<number, string>();
  try {
    const url = `${apiBase.replace(/\/$/, "")}/api/game-data/champions?lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as Champion[];
      if (Array.isArray(data)) {
        for (const c of data) {
          const key = Number(c?.key);
          if (Number.isFinite(key) && key > 0 && c?.name) {
            map.set(key, c.name);
          }
        }
      }
    }
  } catch {
    /* offline / API unavailable */
  }
  cacheByLang.set(lang, map);
  return map;
}

export function championDisplayName(
  map: Map<number, string>,
  championId: number | null | undefined,
  fallback = "—"
): string {
  if (!championId || championId <= 0) return fallback;
  return map.get(championId) ?? `#${championId}`;
}
