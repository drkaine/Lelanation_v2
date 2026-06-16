import { apiBase } from "./config";

const PROBE_URLS = [
  `${apiBase.replace(/\/$/, "")}/`,
  "https://clients3.google.com/generate_204",
  "https://www.cloudflare.com/cdn-cgi/trace",
];

async function probeUrl(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok || res.status === 204;
  } catch {
    try {
      await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: controller.signal });
      return true;
    } catch {
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}

/** WebView fetch probe (system TLS / proxy stack used by the rest of the app). */
export async function probeInternetFromWebView(timeoutMs = 8000): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  for (const url of PROBE_URLS) {
    if (await probeUrl(url, timeoutMs)) {
      return true;
    }
  }
  return false;
}
