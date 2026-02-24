const CONSENT_KEY = "lelanation_companion_consent";

export interface ConsentData {
  accepted: boolean;
  date: string;
  version: string;
}

export function getConsent(): ConsentData | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentData;
  } catch {
    return null;
  }
}

export function setConsent(): void {
  if (typeof localStorage === "undefined") return;
  const data: ConsentData = {
    accepted: true,
    date: new Date().toISOString(),
    version: "1",
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
}

export function hasConsent(): boolean {
  const c = getConsent();
  return c?.accepted === true;
}
