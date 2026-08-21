/** champion_vs_stats metric column labels (subset with values from LCU highlighted). */

export const METRIC_GROUPS = [
  {
    id: "general",
    labelKey: "progression.metrics.general",
    keys: ["sum_gold_earned", "sum_gold_spent", "sum_minions_killed_u15"],
  },
  {
    id: "combat",
    labelKey: "progression.metrics.combat",
    keys: ["sum_kill_u15", "sum_death_u15", "sum_assist_u15", "sum_vision_score_u15"],
  },
  {
    id: "cs",
    labelKey: "progression.metrics.cs",
    keys: ["sum_cs_5min", "sum_cs_10min", "sum_cs_15min", "sum_cs_opponent_5min", "sum_cs_opponent_10min"],
  },
  {
    id: "lane",
    labelKey: "progression.metrics.lane",
    keys: [
      "sum_kill_opponent_5min",
      "sum_kill_opponent_10min",
      "sum_death_by_opponent_5min",
      "sum_death_by_opponent_10min",
      "sum_gold_difference_5min",
      "sum_gold_difference_10min",
      "sum_cs_difference_5min",
      "sum_cs_difference_10min",
    ],
  },
  {
    id: "objectives",
    labelKey: "progression.metrics.objectives",
    keys: [
      "sum_drake_kill",
      "sum_drake_assist",
      "sum_herald_kill",
      "sum_void_kill",
      "sum_first_tower",
      "sum_turret_plate_taken",
    ],
  },
] as const;

const LABELS_FR: Record<string, string> = {
  sum_gold_earned: "Or gagné",
  sum_gold_spent: "Or dépensé",
  sum_minions_killed_u15: "CS total",
  sum_kill_u15: "Kills",
  sum_death_u15: "Morts",
  sum_assist_u15: "Assists",
  sum_vision_score_u15: "Score de vision",
  sum_cs_5min: "CS @ 5 min",
  sum_cs_10min: "CS @ 10 min",
  sum_cs_15min: "CS @ 15 min",
  sum_cs_opponent_5min: "CS adversaire @ 5 min",
  sum_cs_opponent_10min: "CS adversaire @ 10 min",
  sum_kill_opponent_5min: "Kills vs lane @ 5 min",
  sum_kill_opponent_10min: "Kills vs lane @ 10 min",
  sum_death_by_opponent_5min: "Morts vs lane @ 5 min",
  sum_death_by_opponent_10min: "Morts vs lane @ 10 min",
  sum_gold_difference_5min: "Diff. or @ 5 min",
  sum_gold_difference_10min: "Diff. or @ 10 min",
  sum_cs_difference_5min: "Diff. CS @ 5 min",
  sum_cs_difference_10min: "Diff. CS @ 10 min",
  sum_drake_kill: "Drakes (kill)",
  sum_drake_assist: "Drakes (assist)",
  sum_herald_kill: "Herald (kill)",
  sum_void_kill: "Void grubs (kill)",
  sum_first_tower: "Première tour",
  sum_turret_plate_taken: "Plaques de tour",
};

const LABELS_EN: Record<string, string> = {
  sum_gold_earned: "Gold earned",
  sum_gold_spent: "Gold spent",
  sum_minions_killed_u15: "Total CS",
  sum_kill_u15: "Kills",
  sum_death_u15: "Deaths",
  sum_assist_u15: "Assists",
  sum_vision_score_u15: "Vision score",
  sum_cs_5min: "CS @ 5 min",
  sum_cs_10min: "CS @ 10 min",
  sum_cs_15min: "CS @ 15 min",
  sum_cs_opponent_5min: "Opponent CS @ 5 min",
  sum_cs_opponent_10min: "Opponent CS @ 10 min",
  sum_kill_opponent_5min: "Lane kills @ 5 min",
  sum_kill_opponent_10min: "Lane kills @ 10 min",
  sum_death_by_opponent_5min: "Lane deaths @ 5 min",
  sum_death_by_opponent_10min: "Lane deaths @ 10 min",
  sum_gold_difference_5min: "Gold diff. @ 5 min",
  sum_gold_difference_10min: "Gold diff. @ 10 min",
  sum_cs_difference_5min: "CS diff. @ 5 min",
  sum_cs_difference_10min: "CS diff. @ 10 min",
  sum_drake_kill: "Drakes (kill)",
  sum_drake_assist: "Drakes (assist)",
  sum_herald_kill: "Herald (kill)",
  sum_void_kill: "Void grubs (kill)",
  sum_first_tower: "First tower",
  sum_turret_plate_taken: "Turret plates",
};

export function metricLabel(language: "fr" | "en", key: string): string {
  const map = language === "fr" ? LABELS_FR : LABELS_EN;
  return map[key] ?? key.replace(/^sum_/, "").replace(/_/g, " ");
}

export function queueLabel(language: "fr" | "en", queueId?: number | null, gameMode?: string): string {
  const id = queueId ?? 0;
  const fr: Record<number, string> = {
    420: "Classé Solo/Duo",
    440: "Classé Flex",
    400: "Normal draft",
    430: "Normal blind",
    450: "ARAM",
    900: "URF",
    1020: "One for All",
    1300: "Nexus Blitz",
    1400: "Ultimate Spellbook",
    1700: "Arena",
    1900: "URF",
  };
  const en: Record<number, string> = {
    420: "Ranked Solo/Duo",
    440: "Ranked Flex",
    400: "Draft Pick",
    430: "Blind Pick",
    450: "ARAM",
    900: "URF",
    1020: "One for All",
    1300: "Nexus Blitz",
    1400: "Ultimate Spellbook",
    1700: "Arena",
    1900: "URF",
  };
  const map = language === "fr" ? fr : en;
  if (map[id]) return map[id];
  if (gameMode) return gameMode;
  return language === "fr" ? "Partie" : "Match";
}

export function roleLabel(language: "fr" | "en", role: string): string {
  const r = role.toLowerCase();
  const fr: Record<string, string> = {
    top: "Top",
    jungle: "Jungle",
    middle: "Mid",
    bottom: "ADC",
    utility: "Support",
  };
  const en: Record<string, string> = { ...fr };
  const map = language === "fr" ? fr : en;
  return map[r] ?? (role || "—");
}
