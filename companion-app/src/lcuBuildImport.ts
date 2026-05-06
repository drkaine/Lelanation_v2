import { invoke } from "@tauri-apps/api/core";
import type { Build, Item, RuneSelection, ShardSelection, SummonerSpell } from "@lelanation/shared-types";
import { getSettings } from "./settings";

function lcu(method: string, path: string, body: string | null): Promise<string> {
  return invoke<string>("lcu_request", { method, path, body });
}

export function runePagePayload(
  runes: RuneSelection,
  shards: ShardSelection
): { primaryStyleId: number; subStyleId: number; selectedPerkIds: number[] } {
  const { primary, secondary } = runes;
  const selectedPerkIds = [
    primary.keystone,
    primary.slot1,
    primary.slot2,
    primary.slot3,
    secondary.slot1,
    secondary.slot2,
    shards.slot1,
    shards.slot2,
    shards.slot3,
  ];
  return {
    primaryStyleId: primary.pathId,
    subStyleId: secondary.pathId,
    selectedPerkIds,
  };
}

/** Riot item set file format (shop Recommended dropdown). */
export function buildItemSetJson(title: string, items: Item[]): string {
  const rows = items
    .map((i) => {
      let id = String(i.id ?? "").trim();
      if (i.isMasterwork && i.baseItemId) id = String(i.baseItemId).trim();
      if (!/^\d+$/.test(id)) return null;
      return { id, count: 1 };
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

async function applyRunesLcu(pageName: string, runes: RuneSelection, shards: ShardSelection): Promise<void> {
  const payload = runePagePayload(runes, shards);
  for (const id of payload.selectedPerkIds) {
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("Invalid rune or shard id in build.");
    }
  }

  let currentRaw: string;
  try {
    currentRaw = await lcu("GET", "/lol-perks/v1/currentpage", null);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }

  let current: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(currentRaw) as Record<string, unknown> | null;
    if (parsed && typeof parsed.id === "number") current = parsed;
  } catch {
    current = null;
  }

  const name = pageName.trim().slice(0, 48) || "Lelanation";
  const mergedBase = {
    name,
    primaryStyleId: payload.primaryStyleId,
    subStyleId: payload.subStyleId,
    selectedPerkIds: payload.selectedPerkIds,
    current: true,
  };

  if (current) {
    const merged = { ...current, ...mergedBase };
    try {
      await lcu("PUT", `/lol-perks/v1/pages/${current.id as number}`, JSON.stringify(merged));
      return;
    } catch {
      try {
        await lcu("DELETE", `/lol-perks/v1/pages/${current.id as number}`, null);
      } catch {
        /* continue to POST */
      }
    }
  }

  await lcu("POST", "/lol-perks/v1/pages", JSON.stringify(mergedBase));
}

async function tryApplyItemSetLcu(title: string, items: Item[]): Promise<void> {
  const currentSummonerRaw = await lcu("GET", "/lol-summoner/v1/current-summoner", null);
  const currentSummoner = JSON.parse(currentSummonerRaw) as {
    summonerId?: number;
    id?: number;
  };
  const summonerId = Number(currentSummoner.summonerId ?? currentSummoner.id ?? 0);
  if (!Number.isFinite(summonerId) || summonerId <= 0) {
    throw new Error("Cannot resolve current summoner id");
  }

  const itemSetPayload = JSON.parse(buildItemSetJson(title, items)) as Record<string, unknown>;
  await lcu(
    "POST",
    `/lol-item-sets/v1/item-sets/${summonerId}/sets`,
    JSON.stringify(itemSetPayload)
  );
}

function summonerSpellNumericId(spell: SummonerSpell | null): number | null {
  if (!spell) return null;
  const raw = String(spell.id ?? "").trim();
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return null;
}

async function tryApplySummonerSpells(
  spells: [SummonerSpell | null, SummonerSpell | null]
): Promise<void> {
  const s = getSettings();
  if (!s.importSummonerSpells) return;
  const a = summonerSpellNumericId(spells[0]);
  const b = summonerSpellNumericId(spells[1]);
  if (a == null || b == null) return;

  const body = JSON.stringify({ spell1Id: a, spell2Id: b });
  try {
    await lcu("PATCH", "/lol-champ-select/v1/session/my-selection", body);
  } catch {
    try {
      await lcu("PATCH", "/lol-champ-select-legacy/v1/session/my-selection", body);
    } catch {
      /* not in champion select — expected */
    }
  }
}

/**
 * Imports runes + shards via LCU, writes champion item set JSON under League Config,
 * best-effort summoner spells in champion select.
 */
export async function importBuildToLcu(build: Build): Promise<void> {
  const s = getSettings();
  const conn = await invoke<{ ok: boolean }>("get_lcu_connection");
  if (!conn.ok) {
    throw new Error("LCU_OFFLINE");
  }

  const championKey = build.champion?.id?.trim();
  if (!championKey) {
    throw new Error("NO_CHAMPION");
  }

  let didSomething = false;

  if (s.importRunes && build.runes && build.shards) {
    try {
      const pageTitle = build.name?.trim() || build.id;
      await applyRunesLcu(pageTitle, build.runes, build.shards);
      didSomething = true;
    } catch (e) {
      throw new Error(`RUNES:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (s.importItems && build.items?.length) {
    const json = buildItemSetJson(build.name || build.id, build.items);
    const parsed = JSON.parse(json) as { blocks?: Array<{ items?: unknown[] }> };
    const count = parsed.blocks?.[0]?.items?.length ?? 0;
    if (count > 0) {
      try {
        try {
          await tryApplyItemSetLcu(build.name || build.id, build.items);
        } catch {
          // Fallback: write to League Config file when LCU endpoint is unavailable.
          await invoke<string>("companion_write_champion_item_set", {
            championKey,
            titleStem: `${build.id}_${(build.name || "build").slice(0, 24)}`,
            jsonContent: json,
          });
        }
        didSomething = true;
      } catch (e) {
        throw new Error(`ITEMS:${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (!didSomething) {
    throw new Error("NOTHING_TO_IMPORT");
  }

  await tryApplySummonerSpells(build.summonerSpells);
}
