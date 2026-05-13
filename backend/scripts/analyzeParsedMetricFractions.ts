/**
 * Analyse parseMatch(match, timeline) : clés numériques non entières (|x-round(x)| > 1e-4).
 * Usage : npx tsx scripts/analyzeParsedMetricFractions.ts
 *
 * Les colonnes champion_stats / vs / duo / botlane concernées → migration
 * `drizzle/migrations/0008_champion_stats_challenge_floats.sql`.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAMPION_STATS_METRIC_COLUMNS } from "../src/constants/championStatsMetricColumns.js";
import type { ParsedParticipantDto } from "../src/dto/match.dto.js";
import { parseMatch } from "../src/parsers/match.parser.js";
import type { MatchDto, MatchTimelineDto } from "../src/riot/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function extractPatch(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? "").split(".");
  if (!major || !minor) return "unknown";
  return `${major}.${minor}`;
}

function unwrapMatch(raw: unknown): MatchDto {
  const o = raw as Record<string, unknown>;
  if (o?.metadata && o?.info) return { metadata: o.metadata, info: o.info } as MatchDto;
  return raw as MatchDto;
}

function unwrapTimeline(raw: unknown): MatchTimelineDto {
  const o = raw as Record<string, unknown>;
  if (o?.metadata && o?.info) return { metadata: o.metadata, info: o.info } as MatchTimelineDto;
  return raw as MatchTimelineDto;
}

const EPS = 1e-4;

function isNonIntegerMetric(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) > EPS;
}

function scanParticipant(p: ParsedParticipantDto): Set<string> {
  const bad = new Set<string>();
  const rec = p as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (!k.startsWith("sum_") && !k.startsWith("count_")) continue;
    if (!isNonIntegerMetric(v)) continue;
    bad.add(k);
  }
  return bad;
}

async function main(): Promise<void> {
  const root = join(__dirname, "..");
  const matchPath = join(root, "data/api-riot/match-id.json");
  const tlPath = join(root, "data/api-riot/timeline.json");
  const matchRaw = JSON.parse(await readFile(matchPath, "utf8"));
  const tlRaw = JSON.parse(await readFile(tlPath, "utf8"));
  const match = unwrapMatch(matchRaw);
  const timeline = unwrapTimeline(tlRaw);
  const patch = extractPatch(match.info.gameVersion);
  const rows = parseMatch(match, timeline, patch).filter((x): x is ParsedParticipantDto => x !== null);

  const union = new Set<string>();
  for (const p of rows) {
    for (const k of scanParticipant(p)) union.add(k);
  }

  const inChampionStats = CHAMPION_STATS_METRIC_COLUMNS.filter((c) => union.has(c));
  const extra = [...union].filter((c) => !CHAMPION_STATS_METRIC_COLUMNS.includes(c as never)).sort();

  console.log(JSON.stringify({ sampleMatch: match.metadata?.matchId, nonIntegerKeys: [...union].sort(), inChampionStats, extraKeysNotInChampionStatsColumns: extra }, null, 2));
}

void main();
