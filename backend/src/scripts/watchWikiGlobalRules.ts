/**
 * Compare hardcoded global stats (absent from Data Dragon) against the official LoL wiki.
 *
 * Usage:
 *   npm run watch:wiki-global-rules
 *   npm run watch:wiki-global-rules -- --patch 16.5 --silent
 */
import { watchWikiGlobalRules } from "../services/WikiGlobalRulesWatchService.js";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

const patch =
  readArg("--patch") ??
  process.env.GAME_PATCH ??
  "manual";

const silent = process.argv.includes("--silent");

const result = await watchWikiGlobalRules({
  patch,
  triggeredBy: "cli:watchWikiGlobalRules",
  silent,
});

if (!result.ok) {
  console.error("[watchWikiGlobalRules] failed:", result.error);
  process.exit(1);
}

console.log(
  `[watchWikiGlobalRules] patch=${result.patch} ok=${result.rules.filter((r) => r.status === "ok").length}/${result.rules.length} drift=${result.driftCount} errors=${result.errorCount}`
);

if (result.driftCount > 0 || result.errorCount > 0) {
  for (const rule of result.rules.filter((r) => r.status !== "ok")) {
    console.warn(`  - ${rule.label}: ${rule.message ?? rule.status}`);
  }
  process.exit(2);
}
