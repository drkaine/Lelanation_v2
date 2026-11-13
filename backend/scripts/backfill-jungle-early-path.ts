/**
 * Recalcule `participants.jungle_camp_history.early_path` (full clear reconstruit).
 * Usage : npx tsx scripts/backfill-jungle-early-path.ts [--dry-run]
 */
import "dotenv/config";
import { sql } from "../src/db/client.js";
import { recalculateEarlyPath } from "../src/parsers/junglePathExtract.js";

const DRY = process.argv.includes("--dry-run");
const BATCH = 2_000;

type Row = { riot_match_id: string; participant_id: number; doc: unknown };

let cursorMatch = "";
let cursorPid = 0;
let scanned = 0;
let updated = 0;

for (;;) {
  const rows = await sql<Row[]>`
    SELECT riot_match_id, participant_id, jungle_camp_history AS doc
    FROM participants
    WHERE jungle_camp_history IS NOT NULL
      AND jungle_camp_history ? 'early_path'
      AND (riot_match_id, participant_id) > (${cursorMatch}, ${cursorPid})
    ORDER BY riot_match_id, participant_id
    LIMIT ${BATCH}
  `;
  if (!rows.length) break;

  for (const r of rows) {
    scanned++;
    const next = recalculateEarlyPath(r.doc);
    if (!next?.early_path) continue;
    const prevHash = (r.doc as { early_path?: { path_hash?: string } })?.early_path?.path_hash;
    if (prevHash === next.early_path.path_hash) continue;
    updated++;
    if (!DRY) {
      await sql`
        UPDATE participants
        SET jungle_camp_history = ${sql.json(next as never)}
        WHERE riot_match_id = ${r.riot_match_id} AND participant_id = ${r.participant_id}
      `;
    }
  }
  const last = rows[rows.length - 1]!;
  cursorMatch = last.riot_match_id;
  cursorPid = last.participant_id;
  console.log(`[backfill-jungle] scannés ${scanned}, modifiés ${updated}${DRY ? " (dry-run)" : ""}`);
}

console.log(`[backfill-jungle] terminé : ${updated}/${scanned}${DRY ? " (dry-run)" : ""}`);
process.exit(0);
