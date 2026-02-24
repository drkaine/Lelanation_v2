const SETTINGS_KEY = "lelanation_companion_settings";

export interface ImportSettings {
  importRunes: boolean;
  importItems: boolean;
  importSummonerSpells: boolean;
  disableMatchSubmission: boolean;
  language: "fr" | "en";
}

const defaults: ImportSettings = {
  importRunes: true,
  importItems: true,
  importSummonerSpells: true,
  disableMatchSubmission: false,
  language: "fr",
};

export function getSettings(): ImportSettings {
  if (typeof localStorage === "undefined") return { ...defaults };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<ImportSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export function setSettings(s: Partial<ImportSettings>): void {
  if (typeof localStorage === "undefined") return;
  const current = getSettings();
  const next = { ...current, ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}
