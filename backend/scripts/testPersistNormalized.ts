import { readFileSync } from "fs";
import { sql } from "../src/db/client.js";
import { persistNormalizedMatch } from "../src/services/normalizedMatchPersistence.js";

async function main(): Promise<void> {
  const timelineWrap = JSON.parse(readFileSync("./data/api-riot/timeline.json", "utf8"));
  const matchWrap = JSON.parse(readFileSync("./data/api-riot/match-id.json", "utf8"));
  const timeline = { metadata: timelineWrap.metadata, info: timelineWrap.info };
  const match = { metadata: matchWrap.metadata, info: matchWrap.info };

  await sql.begin(async (tx) => {
    await persistNormalizedMatch(tx, match, timeline, "euw1");
  });
  const rows = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM matchs`;
  console.log("matchs", rows[0]?.n);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
