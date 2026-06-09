import { invoke } from "@tauri-apps/api/core";
import type {
  Build,
  Item,
  RuneSelection,
  ShardSelection,
  SummonerSpell,
} from "@lelanation/shared-types";
import { getSettings } from "./settings";
import type { ApplyResult, BuildPayload } from "./composables/useLcuExport";

export function runePagePayload(
  runes: RuneSelection,
  shards: ShardSelection
): NonNullable<BuildPayload["runes"]> {
  const { primary, secondary } = runes;
  const toRuneId = (value: unknown): number => Number(value);
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
  const shardIds = [toRuneId(shards.slot1), toRuneId(shards.slot2), toRuneId(shards.slot3)] as [
    number,
    number,
    number,
  ];
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
  const key = build.champion?.key ?? build.champion?.id ?? "";
  const n = Number.parseInt(String(key).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
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

  const championKey = build.champion?.id?.trim();
  if (!championKey) {
    throw new Error("NO_CHAMPION");
  }

  const payload = buildToPayload(build);
  const hasContent =
    payload.runes != null || payload.items != null || payload.summonerSpells != null;
  if (!hasContent) {
    throw new Error("NOTHING_TO_IMPORT");
  }

  try {
    const result = await invoke<ApplyResult>("apply_build", { build: payload });

    if (!result.items && payload.items && payload.importItems && build.items?.length) {
      try {
        const json = buildItemSetJson(build.name || build.id, build.items);
        await invoke<string>("companion_write_champion_item_set", {
          championKey,
          titleStem: `${build.id}_${(build.name || "build").slice(0, 24)}`,
          jsonContent: json,
        });
        result.items = true;
      } catch (e) {
        result.errors.push(
          `Items fallback: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    if (!result.runes && !result.items && !result.summoners && !result.summonersPending) {
      throw new Error(result.errors.join("; ") || "NOTHING_TO_IMPORT");
    }

    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Nothing to import")) throw new Error("NOTHING_TO_IMPORT");
    throw new Error(msg.startsWith("Runes:") || msg.startsWith("Items:") ? msg : msg);
  }
}

export function describeApplyResult(result: ApplyResult, lang: "fr" | "en"): string {
  if (lang === "en") {
    const lines: string[] = [];
    if (result.runes) lines.push("Rune page applied");
    if (result.items) lines.push("Item set applied");
    if (result.summoners) lines.push("Summoner spells set");
    if (result.summonersPending) lines.push("Summoner spells queued for champion select");
    return lines.join(" · ") || formatApplyResult(result);
  }
  const lines: string[] = [];
  if (result.runes) lines.push("Runes appliquées");
  if (result.items) lines.push("Items appliqués");
  if (result.summoners) lines.push("Sorts définis");
  if (result.summonersPending) lines.push("Sorts en attente (champ select)");
  return lines.join(" · ") || formatApplyResult(result);
}
