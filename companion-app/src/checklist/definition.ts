import type { ChecklistItem, CheckResultKind } from "../types/checklist";

export const CHECKLIST_SECTION_ORDER = [
  "farm",
  "warding",
  "survival",
  "objectives",
  "manual",
] as const;

export const CHECKLIST_ITEM_ORDER = [
  "cs_at_5",
  "cs_at_10",
  "cs_per_min",
  "pink_wards",
  "wards_placed",
  "vision_denied",
  "survival",
  "team_objectives",
  "minimap",
  "ping_missing",
  "wave_management",
  "objective_focus",
] as const;

export const ITEM_SECTIONS: Record<string, string> = {
  cs_at_5: "farm",
  cs_at_10: "farm",
  cs_per_min: "farm",
  pink_wards: "warding",
  wards_placed: "warding",
  vision_denied: "warding",
  survival: "survival",
  team_objectives: "objectives",
  minimap: "manual",
  ping_missing: "manual",
  wave_management: "manual",
  objective_focus: "manual",
};

export const MEASURABLE_IDS = new Set<string>([
  "cs_at_5",
  "cs_at_10",
  "cs_per_min",
  "pink_wards",
  "wards_placed",
  "vision_denied",
  "survival",
  "team_objectives",
]);

export function isMeasurableItem(id: string): boolean {
  return MEASURABLE_IDS.has(id);
}

export function blankItem(id: string): ChecklistItem {
  return {
    id,
    kind: "unmeasurable",
    detail: null,
    manualChecked: false,
  };
}

export function createBlankChecklistItems(): ChecklistItem[] {
  return CHECKLIST_ITEM_ORDER.map((id) => blankItem(id));
}

export function normalizeChecklistItems(saved: ChecklistItem[]): ChecklistItem[] {
  const byId = new Map(saved.map((i) => [i.id, i]));
  return CHECKLIST_ITEM_ORDER.map((id) => {
    const existing = byId.get(id);
    if (existing) return { ...existing };
    return blankItem(id);
  });
}

export function recalcChecklistScore(items: ChecklistItem[]): {
  score: number;
  measuredCount: number;
  checkedCount: number;
} {
  const measured = items.filter((i) => isMeasurableItem(i.id));
  const measuredCount = measured.length;
  const effective = (item: ChecklistItem): CheckResultKind => {
    if (isMeasurableItem(item.id)) {
      return item.userKind ?? item.kind;
    }
    return item.manualChecked ? "checked" : "unmeasurable";
  };
  const checkedCount = measured.filter((i) => effective(i) === "checked").length;
  const partialCount = measured.filter((i) => effective(i) === "partial").length;
  const score =
    measuredCount === 0
      ? 0
      : ((checkedCount + partialCount * 0.5) / measuredCount) * 100;
  return { score, measuredCount, checkedCount };
}
