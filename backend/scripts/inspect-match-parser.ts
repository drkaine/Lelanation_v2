import { readFile } from "node:fs/promises";
import { parseMatch } from "../src/parsers/match.parser.js";
import type { MatchDto, MatchTimelineDto } from "../src/riot/types.js";

async function main(): Promise<void> {
  const matchRaw = await readFile("./data/api-riot/match-id.json", "utf8");
  const timelineRaw = await readFile("./data/api-riot/timeline.json", "utf8");

  const match = JSON.parse(matchRaw) as MatchDto;
  const timeline = JSON.parse(timelineRaw) as MatchTimelineDto;

  const parsed = parseMatch(match, timeline, "fallback");
  const nonNull = parsed.filter((p): p is NonNullable<(typeof parsed)[number]> => p !== null);

  console.log("participants_total=", parsed.length);
  console.log("participants_non_null=", nonNull.length);
  console.log("participants_null=", parsed.length - nonNull.length);

  if (nonNull.length > 0) {
    console.log("sample_dto=", JSON.stringify(nonNull[0], null, 2));
  }
}

main().catch((error) => {
  console.error("inspect parser failed", error);
  process.exitCode = 1;
});
