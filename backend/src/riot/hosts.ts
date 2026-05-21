import { normalizePlatformRegion } from "./platform-region.js";

const PLATFORM_TO_REGIONAL: Record<string, string> = {
  euw1: "europe",
  eun1: "europe",
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  kr: "asia",
  jp1: "asia",
  oc1: "sea",
  tr1: "europe",
  ru: "europe",
};

/** Match-v5 / Account-v1 — routing continental (compteur rate limit séparé). */
export function toRegionalHost(platform: string): string {
  const key = normalizePlatformRegion(platform).toLowerCase();
  const regional = PLATFORM_TO_REGIONAL[key] ?? "europe";
  return `https://${regional}.api.riotgames.com`;
}

/** League-v4 / Summoner-v4 — host platform (compteur rate limit séparé). */
export function toPlatformHost(platform: string): string {
  const key = normalizePlatformRegion(platform).toLowerCase();
  return `https://${key}.api.riotgames.com`;
}

/** @deprecated use toRegionalHost — hostname only */
export function getRegionalHost(platform: string): string {
  return toRegionalHost(platform).replace(/^https:\/\//, "");
}

/** @deprecated use toPlatformHost — hostname only */
export function getPlatformHost(platform: string): string {
  return toPlatformHost(platform).replace(/^https:\/\//, "");
}

export function riotRoutingSummary(): string {
  return "Match-v5 → europe | League-v4 → euw1/eun1";
}
