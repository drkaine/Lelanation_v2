import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const sendSuccess = vi.fn().mockResolvedValue({ isOk: () => true });
const sendAlert = vi.fn().mockResolvedValue({ isOk: () => true });

vi.mock("../../src/services/DiscordService.js", () => ({
  DiscordService: class MockDiscordService {
    sendSuccess = sendSuccess;
    sendAlert = sendAlert;
  },
}));

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "wiki"
);

vi.mock("../../src/scraper/wikiFetcher.js", () => ({
  withWikiBrowser: vi.fn(async (fn: (browser: unknown) => Promise<unknown>) => fn({})),
  fetchWikiPageContent: vi.fn(async (url: string) => {
    if (url.includes("Critical_strike")) {
      return readFileSync(join(fixturesDir, "critical-strike.snippet.html"), "utf-8");
    }
    if (url.includes("Champion_statistic")) {
      return readFileSync(join(fixturesDir, "champion-statistic.snippet.html"), "utf-8");
    }
    throw new Error(`Unexpected URL: ${url}`);
  }),
}));

describe("WikiGlobalRulesWatchService", () => {
  let tempCwd: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    sendSuccess.mockClear();
    sendAlert.mockClear();
    tempCwd = await mkdtemp(join(tmpdir(), "wiki-watch-"));
    process.chdir(tempCwd);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempCwd, { recursive: true, force: true });
  });

  it("persists audit and notifies success when wiki matches constants", async () => {
    const { watchWikiGlobalRules } = await import(
      "../../src/services/WikiGlobalRulesWatchService.js"
    );
    const { notifyWikiGlobalRulesChecked } = await import(
      "../../src/services/gameDataSyncAlerts.js"
    );

    const result = await watchWikiGlobalRules({
      patch: "16.5",
      triggeredBy: "test",
      silent: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.driftCount).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.rules.every((rule) => rule.status === "ok")).toBe(true);

    await notifyWikiGlobalRulesChecked({
      patch: result.patch,
      checkedAt: result.checkedAt,
      driftCount: result.driftCount,
      errorCount: result.errorCount,
      rules: result.rules,
      triggeredBy: "test",
    });

    expect(sendSuccess).toHaveBeenCalledOnce();
    expect(sendAlert).not.toHaveBeenCalled();
  });
});

describe("notifyWikiGlobalRulesChecked", () => {
  beforeEach(() => {
    sendSuccess.mockClear();
    sendAlert.mockClear();
  });

  it("sends alert when drift is detected", async () => {
    const { notifyWikiGlobalRulesChecked } = await import(
      "../../src/services/gameDataSyncAlerts.js"
    );

    await notifyWikiGlobalRulesChecked({
      patch: "16.5",
      checkedAt: new Date().toISOString(),
      driftCount: 1,
      errorCount: 0,
      rules: [
        {
          id: "baseCritDamagePercent",
          label: "Dégâts de crit de base",
          status: "drift",
          ourValue: 200,
          wikiValue: 175,
          message: "Wiki=175, Lelanation=200",
        },
      ],
      triggeredBy: "test",
    });

    expect(sendAlert).toHaveBeenCalledOnce();
    expect(sendSuccess).not.toHaveBeenCalled();
  });
});
