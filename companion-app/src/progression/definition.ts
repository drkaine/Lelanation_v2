import template from "../../progression-template.json";

export const PROGRESSION_ITEM_ORDER = template.itemOrder as string[];
export const ITEM_SECTIONS = template.sections as Record<string, string>;

export const PROGRESSION_TABS = [
  { id: "base", sections: ["base"] },
  { id: "farm", sections: ["farm", "farm_training", "farm_tower"] },
  { id: "wave", sections: ["wave"] },
  { id: "lane", sections: ["lane"] },
  { id: "warding", sections: ["warding"] },
  { id: "map", sections: ["map_awareness"] },
] as const;

export type ProgressionTabId = (typeof PROGRESSION_TABS)[number]["id"];

export const INTERNET_ITEM_ID = "base_stable_internet";

export function itemsForTab(tabId: ProgressionTabId): string[] {
  const tab = PROGRESSION_TABS.find((t) => t.id === tabId);
  if (!tab) return [];
  const sections = new Set<string>(tab.sections);
  return PROGRESSION_ITEM_ORDER.filter((id) => sections.has(ITEM_SECTIONS[id] ?? ""));
}

export function itemsGroupedBySection(tabId: ProgressionTabId): { section: string; ids: string[] }[] {
  const tab = PROGRESSION_TABS.find((t) => t.id === tabId);
  if (!tab) return [];
  return tab.sections
    .map((section) => ({
      section,
      ids: PROGRESSION_ITEM_ORDER.filter((id) => ITEM_SECTIONS[id] === section),
    }))
    .filter((g) => g.ids.length > 0);
}
