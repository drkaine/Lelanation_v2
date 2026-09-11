/**
 * Fetch wiki page content via the MediaWiki API.
 * Uses Playwright when plain fetch is blocked by Cloudflare (common on server IPs).
 */

import { spawnSync } from "node:child_process";
import type { Browser } from "playwright";
import {
  ensurePlaywrightBrowsersPath,
  launchChromium,
} from "../utils/playwrightBrowser.js";

const WIKI_API = "https://wiki.leagueoflegends.com/api.php";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 1000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type WikiParseResponse = {
  parse?: {
    text?: {
      "*": string;
    };
  };
  error?: {
    code?: string;
    info?: string;
  };
};

export function wikiPageTitleFromUrl(wikiPageUrl: string): string {
  const url = new URL(wikiPageUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? "");
}

function buildWikiApiUrl(pageTitle: string): string {
  return `${WIKI_API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json`;
}

async function fetchWikiApiWithHttp(apiUrl: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWikiApiWithCurl(apiUrl: string): Promise<string> {
  const result = spawnSync(
    "curl",
    ["-sSL", "-A", USER_AGENT, "-H", "Accept: application/json", apiUrl],
    {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    }
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `curl exited with code ${result.status}`);
  }
  if (!result.stdout?.trim()) {
    throw new Error("curl returned empty response");
  }
  return result.stdout;
}

async function fetchWikiApiWithPlaywright(
  apiUrl: string,
  browser: Browser
): Promise<string> {
  const page = await browser.newPage({
    userAgent: USER_AGENT,
  });
  try {
    const response = await page.goto(apiUrl, {
      waitUntil: "domcontentloaded",
      timeout: FETCH_TIMEOUT_MS,
    });
    if (!response || !response.ok()) {
      throw new Error(
        `HTTP ${response?.status() ?? "unknown"}: ${response?.statusText() ?? "no response"}`
      );
    }
    return response.text();
  } finally {
    await page.close();
  }
}

function parseWikiApiPayload(rawJson: string, pageTitle: string): string {
  const payload = JSON.parse(rawJson) as WikiParseResponse;
  if (payload.error) {
    throw new Error(payload.error.info ?? payload.error.code ?? "Wiki API error");
  }
  const html = payload.parse?.text?.["*"];
  if (!html) {
    throw new Error(`Wiki API returned no content for ${pageTitle}`);
  }
  return html;
}

export async function fetchWikiPageContent(
  wikiPageUrl: string,
  options?: {
    browser?: Browser;
    retries?: number;
  }
): Promise<string> {
  const pageTitle = wikiPageTitleFromUrl(wikiPageUrl);
  const apiUrl = buildWikiApiUrl(pageTitle);
  const retries = options?.retries ?? MAX_RETRIES;
  let browser = options?.browser;
  let ownsBrowser = false;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let rawJson: string;
      try {
        rawJson = await fetchWikiApiWithHttp(apiUrl);
      } catch {
        try {
          rawJson = await fetchWikiApiWithCurl(apiUrl);
        } catch {
          if (!browser) {
            ensurePlaywrightBrowsersPath();
            browser = await launchChromium();
            ownsBrowser = true;
          }
          rawJson = await fetchWikiApiWithPlaywright(apiUrl, browser);
        }
      }
      return parseWikiApiPayload(rawJson, pageTitle);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_BASE_MS * attempt));
      }
    }
  }

  if (ownsBrowser && browser) {
    await browser.close().catch(() => undefined);
  }

  throw new Error(
    `Failed to fetch wiki page ${pageTitle} after ${retries} attempts: ${lastError?.message ?? "unknown error"}`
  );
}

export async function withWikiBrowser<T>(
  fn: (browser: Browser) => Promise<T>
): Promise<T> {
  ensurePlaywrightBrowsersPath();
  const browser = await launchChromium();
  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
