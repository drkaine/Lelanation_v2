import { join } from "path";
import {
  checkWikiGlobalRule,
  groupWikiRulesByPage,
  type WikiRuleCheckResult,
} from "@lelanation/builds-stats/wikiGlobalRules";
import {
  checkWikiStatCalculation,
  groupWikiStatCalculationsByPage,
} from "@lelanation/builds-stats/wikiStatCalculations";
import { fetchWikiPageContent } from "../scraper/wikiFetcher.js";
import { FileManager } from "../utils/fileManager.js";
import { createCronLogger } from "../utils/cronLogger.js";
import { notifyWikiGlobalRulesChecked } from "./gameDataSyncAlerts.js";

const wikiWatchLog = createCronLogger("wikiGlobalRulesWatch");

export type WikiGlobalRulesAuditFile = {
  patch: string;
  checkedAt: string;
  triggeredBy?: string;
  rules: WikiRuleCheckResult[];
  driftCount: number;
  errorCount: number;
};

export type WikiGlobalRulesWatchResult =
  | (WikiGlobalRulesAuditFile & { ok: true })
  | { ok: false; error: string; triggeredBy?: string };

function resolveAuditDir(): string {
  return join(process.cwd(), "data", "game", "wiki-global-rules-audit");
}

function resolveLatestAuditPath(): string {
  return join(resolveAuditDir(), "latest.json");
}

function resolvePatchAuditPath(patch: string): string {
  const safePatch = patch.replace(/[^\d.]/g, "");
  return join(resolveAuditDir(), `${safePatch}.json`);
}

async function persistAudit(audit: WikiGlobalRulesAuditFile): Promise<void> {
  const patchResult = await FileManager.writeJson(resolvePatchAuditPath(audit.patch), audit);
  if (patchResult.isErr()) {
    throw patchResult.unwrapErr();
  }
  const latestResult = await FileManager.writeJson(resolveLatestAuditPath(), audit);
  if (latestResult.isErr()) {
    throw latestResult.unwrapErr();
  }
}

export async function watchWikiGlobalRules(options: {
  patch: string;
  triggeredBy?: string;
  /** Skip Discord notification (tests / dry runs). */
  silent?: boolean;
}): Promise<WikiGlobalRulesWatchResult> {
  const { patch, triggeredBy, silent = false } = options;
  const checkedAt = new Date().toISOString();
  const rules: WikiRuleCheckResult[] = [];

  await wikiWatchLog.info("Wiki global rules watch started", { patch, triggeredBy });

  const pagesToFetch = new Map<
    string,
    {
      rules: import("@lelanation/builds-stats/wikiGlobalRules").WikiGlobalRuleDefinition[];
      calculations: import("@lelanation/builds-stats/wikiStatCalculations").WikiStatCalculationCheck[];
    }
  >();

  for (const [wikiPage, pageRules] of groupWikiRulesByPage()) {
    pagesToFetch.set(wikiPage, {
      rules: pageRules,
      calculations: pagesToFetch.get(wikiPage)?.calculations ?? [],
    });
  }
  for (const [wikiPage, pageChecks] of groupWikiStatCalculationsByPage()) {
    const existing = pagesToFetch.get(wikiPage);
    pagesToFetch.set(wikiPage, {
      rules: existing?.rules ?? [],
      calculations: pageChecks,
    });
  }

  for (const [wikiPage, { rules: pageRules, calculations: pageChecks }] of pagesToFetch) {
    try {
      const html = await fetchWikiPageContent(wikiPage);
      for (const rule of pageRules) {
        rules.push(checkWikiGlobalRule(html, rule));
      }
      for (const check of pageChecks) {
        rules.push(checkWikiStatCalculation(html, check));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await wikiWatchLog.warn("Wiki page fetch failed", { wikiPage, message });
      for (const rule of pageRules) {
        rules.push({
          id: rule.id,
          label: rule.label,
          status: "parse_error",
          ourValue: rule.ourValue,
          wikiPage: rule.wikiPage,
          ddragonGap: rule.ddragonGap,
          message: `Fetch failed: ${message}`,
        });
      }
      for (const check of pageChecks) {
        rules.push({
          id: check.id,
          label: check.label,
          status: "parse_error",
          ourValue: check.compute(),
          wikiPage: check.wikiPage,
          ddragonGap: check.ddragonGap,
          message: `Fetch failed: ${message}`,
        });
      }
    }
  }

  const driftCount = rules.filter((rule) => rule.status === "drift").length;
  const errorCount = rules.filter((rule) => rule.status === "parse_error").length;

  const audit: WikiGlobalRulesAuditFile = {
    patch,
    checkedAt,
    triggeredBy,
    rules,
    driftCount,
    errorCount,
  };

  try {
    await persistAudit(audit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await wikiWatchLog.warn("Failed to persist wiki rules audit", { message });
  }

  if (!silent) {
    await notifyWikiGlobalRulesChecked({
      patch,
      checkedAt,
      driftCount,
      errorCount,
      rules,
      triggeredBy,
    });
  }

  await wikiWatchLog.info("Wiki global rules watch completed", {
    patch,
    driftCount,
    errorCount,
    okCount: rules.filter((rule) => rule.status === "ok").length,
  });

  return { ok: true, ...audit };
}
