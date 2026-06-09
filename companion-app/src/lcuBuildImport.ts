import { invoke } from "@tauri-apps/api/core";
import type {
  Build,
  Champion,
  Item,
  RuneSelection,
  ShardSelection,
  SummonerSpell,
} from "@lelanation/shared-types";
import { apiBase } from "./config";
import { getSettings } from "./settings";
import type { ApplyResult, BuildPayload } from "./composables/useLcuExport";

let championKeyCache: Map<string, string> | null = null;

async function loadChampionKeyMap(): Promise<Map<string, string>> {
  if (championKeyCache) return championKeyCache;
  const map = new Map<string, string>();
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/game-data/champions`);
    if (res.ok) {
      const data = (await res.json()) as Champion[];
      if (Array.isArray(data)) {
        for (const c of data) {
          if (c?.id && c?.key) map.set(String(c.id).toLowerCase(), String(c.key));
          if (c?.name && c?.key) map.set(String(c.name).toLowerCase(), String(c.key));
        }
      }
    }
  } catch {
    // LCU Rust resolver is the primary fallback.
  }
  championKeyCache = map;
  return map;
}

async function resolveChampionIdViaLcu(folder: string): Promise<number> {
  const trimmed = folder.trim();
  if (!trimmed) return 0;
  try {
    const id = await invoke<number>("resolve_champion_id", { championFolder: trimmed });
    return Number.isFinite(id) && id > 0 ? id : 0;
  } catch {
    return 0;
  }
}

/** Enrich champion.key when API stored builds only ship ChampionRef. */
export async function enrichBuildChampion(build: Build): Promise<Build> {
  if (!build.champion) return build;
  const key = String(build.champion.key ?? "").trim();
  if (/^\d+$/.test(key)) return build;

  const lookupKeys = [
    build.champion.id?.toLowerCase(),
    build.champion.name?.toLowerCase(),
  ].filter(Boolean) as string[];

  const map = await loadChampionKeyMap();
  for (const k of lookupKeys) {
    const resolved = map.get(k);
    if (resolved) {
      return { ...build, champion: { ...build.champion, key: resolved } };
    }
  }
  return build;
}

function toRuneId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Rows from `/lol-perks/v1/styles` (last 3 `kStatMod` slots). */
const LCU_SHARD_ROWS: Record<"offense" | "flex" | "defense", readonly number[]> = {
  offense: [5008, 5005, 5007],
  flex: [5008, 5010, 5001],
  defense: [5011, 5013, 5001],
};

function shardIdsInclude(allowed: readonly number[], id: number): boolean {
  return allowed.some((value) => value === id);
}

/** Site legacy ids (ex. 5002 = PV croissance affiché) → ids acceptés par le client LoL actuel. */
function legacyShardAlias(slot: 1 | 2 | 3, id: number): number {
  if (id === 5006) return 5010;
  if (slot === 1 && (id === 5001 || id === 5002 || id === 5003)) return 5008;
  if (slot === 2 && (id === 5002 || id === 5003)) return 5001;
  if (slot === 3 && (id === 5002 || id === 5012)) return 5001;
  if (slot === 3 && id === 5003) return 5013;
  return id;
}

function pickShardFallback(allowed: readonly number[], preferred: number): number {
  return shardIdsInclude(allowed, preferred) ? preferred : (allowed[0] ?? 5008);
}

function remapShardForLcu(slot: 1 | 2 | 3, id: number): number {
  const allowed =
    slot === 1 ? LCU_SHARD_ROWS.offense : slot === 2 ? LCU_SHARD_ROWS.flex : LCU_SHARD_ROWS.defense;
  const aliased = legacyShardAlias(slot, id);
  if (shardIdsInclude(allowed, aliased)) return aliased;
  if (shardIdsInclude(allowed, id)) return id;
  if (slot === 3 && id === 5002) return pickShardFallback(allowed, 5001);
  if (slot === 3 && id === 5003) return pickShardFallback(allowed, 5013);
  if (slot === 2 && (id === 5002 || id === 5003)) return pickShardFallback(allowed, 5001);
  if (slot === 1) return pickShardFallback(allowed, 5008);
  if (slot === 2) return pickShardFallback(allowed, 5008);
  return pickShardFallback(allowed, 5011);
}

function normalizeShards(shards: ShardSelection): ShardSelection {
  const raw = shards as ShardSelection & { defense?: number; slot?: number };
  const slot1 = toRuneId(raw.slot1) || toRuneId(raw.slot);
  const slot2 = toRuneId(raw.slot2);
  const slot3 = toRuneId(raw.slot3) || toRuneId(raw.defense);
  return {
    slot1: remapShardForLcu(1, slot1 || 5008),
    slot2: remapShardForLcu(2, slot2 || 5008),
    slot3: remapShardForLcu(3, slot3 || 5011),
  };
}

export function runePagePayload(
  runes: RuneSelection,
  shards: ShardSelection
): NonNullable<BuildPayload["runes"]> {
  const { primary, secondary } = runes;
  const normalizedShards = normalizeShards(shards);
  const primaryPerks = [
    toRuneId(primary.keystone),
    toRuneId(primary.slot1),
    toRuneId(primary.slot2),
    toRuneId(primary.slot3),
  ] as [number, number, number, number];
  const secondaryPerks = [toRuneId(secondary.slot1), toRuneId(secondary.slot2)] as [
    number,
    number,
  ];
  const shardIds = [
    normalizedShards.slot1,
    normalizedShards.slot2,
    normalizedShards.slot3,
  ] as [number, number, number];
  return {
    primaryPath: toRuneId(primary.pathId),
    secondaryPath: toRuneId(secondary.pathId),
    perks: {
      primaryPerks,
      secondaryPerks,
      shards: shardIds,
    },
  };
}

function itemNumericId(item: Item): number | null {
  let id = String(item.id ?? "").trim();
  if (item.isMasterwork && item.baseItemId) id = String(item.baseItemId).trim();
  const n = Number.parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Map flat build items into LCU item-set blocks (all items → core unless categorized later). */
export function itemsPayload(items: Item[]): NonNullable<BuildPayload["items"]> {
  const ids = items
    .map(itemNumericId)
    .filter((id): id is number => id != null);
  return {
    starter: [],
    core: ids,
    boots: [],
    optional: [],
  };
}

function summonerSpellNumericId(spell: SummonerSpell | null): number | null {
  if (!spell) return null;
  const candidates = [
    String((spell as unknown as { key?: string | number }).key ?? "").trim(),
    String(spell.id ?? "").trim(),
  ];
  for (const raw of candidates) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function championNumericId(build: Build): number {
  for (const raw of [build.champion?.key, build.champion?.id]) {
    if (raw == null) continue;
    const n = Number.parseInt(String(raw).trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

/** Riot `Config/Champions/<id>/Recommended/` uses the internal champion id (e.g. `Nidalee`, `Ahri`). */
function championFolderKey(build: Build): string {
  const id = build.champion?.id?.trim();
  if (id) return id;
  return build.champion?.key?.trim() ?? "";
}

export function buildToPayload(
  build: Build,
  opts?: {
    importRunes?: boolean;
    importItems?: boolean;
    importSummonerSpells?: boolean;
  }
): BuildPayload {
  const s = getSettings();
  const importRunes = opts?.importRunes ?? s.importRunes;
  const importItems = opts?.importItems ?? s.importItems;
  const importSummonerSpells = opts?.importSummonerSpells ?? s.importSummonerSpells;

  const payload: BuildPayload = {
    name: (build.name?.trim() || build.id).slice(0, 80),
    championId: championNumericId(build),
    championFolder: championFolderKey(build) || undefined,
    buildId: build.id,
    importRunes,
    importItems,
    importSummonerSpells,
  };

  if (importRunes && build.runes && build.shards) {
    payload.runes = runePagePayload(build.runes, build.shards);
  }

  if (importItems && build.items?.length) {
    const mapped = itemsPayload(build.items);
    if (mapped.core.length > 0) {
      payload.items = mapped;
    }
  }

  if (importSummonerSpells) {
    const a = summonerSpellNumericId(build.summonerSpells?.[0] ?? null);
    const b = summonerSpellNumericId(build.summonerSpells?.[1] ?? null);
    if (a != null && b != null) {
      payload.summonerSpells = [a, b];
    }
  }

  return payload;
}

/** Riot item set file format (shop Recommended dropdown) — filesystem fallback. */
export function buildItemSetJson(title: string, items: Item[]): string {
  const rows = items
    .map((i) => {
      const id = itemNumericId(i);
      if (id == null) return null;
      return { id: String(id), count: 1 };
    })
    .filter((x): x is { id: string; count: number } => x != null);

  const body = {
    title: title.slice(0, 80),
    type: "custom",
    map: "any",
    mode: "any",
    priority: true,
    sortrank: 1,
    blocks: [
      {
        type: "Lelanation",
        recMath: false,
        minSummonerLevel: -1,
        maxSummonerLevel: -1,
        showIfSummonerSpell: "",
        hideIfSummonerSpell: "",
        items: rows,
      },
    ],
  };
  return JSON.stringify(body, null, 2);
}

function formatApplyResult(result: ApplyResult): string {
  const parts: string[] = [];
  if (result.runes) parts.push("runes");
  if (result.items) parts.push("items");
  if (result.summoners) parts.push("summoners");
  if (result.summonersPending) parts.push("summoners pending");
  if (result.errors.length) parts.push(...result.errors);
  return parts.join("; ");
}

/**
 * Imports runes, items and summoner spells via Rust `apply_build` command.
 * Falls back to filesystem item set if LCU items fail but runes succeeded.
 */
export async function importBuildToLcu(build: Build): Promise<ApplyResult> {
  const conn = await invoke<{ ok: boolean }>("get_lcu_connection");
  if (!conn.ok) {
    throw new Error("LCU_OFFLINE");
  }

  let enriched = await enrichBuildChampion(build);

  const folder = championFolderKey(enriched);
  let numericChampionId = championNumericId(enriched);
  if (numericChampionId === 0 && folder) {
    numericChampionId = await resolveChampionIdViaLcu(folder);
    if (numericChampionId > 0 && enriched.champion) {
      enriched = {
        ...enriched,
        champion: { ...enriched.champion, key: String(numericChampionId) },
      };
    }
  }

  if (!folder) {
    throw new Error("NO_CHAMPION");
  }

  const payload = buildToPayload(enriched);

  const hasContent =
    payload.runes != null || payload.items != null || payload.summonerSpells != null;
  if (!hasContent) {
    throw new Error("NOTHING_TO_IMPORT");
  }

  try {
    const result = await invoke<ApplyResult>("apply_build", { build: payload });

    if (!result.runes && !result.items && !result.summoners && !result.summonersPending) {
      throw new Error(result.errors.join("; ") || "NOTHING_TO_IMPORT");
    }

    return result;
  } catch (e) {
    const msg =
      typeof e === "string"
        ? e
        : e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : String(e);
    if (msg.includes("Nothing to import")) throw new Error("NOTHING_TO_IMPORT");
    throw new Error(msg);
  }
}

export function describeApplyResult(result: ApplyResult, lang: "fr" | "en"): string {
  if (lang === "en") {
    const lines: string[] = [];
    if (result.runes) lines.push("Rune page applied");
    if (result.items) lines.push("Item set applied");
    if (result.summoners) lines.push("Summoner spells set");
    if (result.summonersPending) lines.push("Summoner spells queued for champion select");
    if (result.errors.length) lines.push(...result.errors);
    return lines.join(" · ") || formatApplyResult(result);
  }
  const lines: string[] = [];
  if (result.runes) lines.push("Runes appliquées");
  if (result.items) lines.push("Items appliqués");
  if (result.summoners) lines.push("Sorts définis");
  if (result.summonersPending) lines.push("Sorts en attente (champ select)");
  if (result.errors.length) lines.push(...result.errors);
  return lines.join(" · ") || formatApplyResult(result);
}
