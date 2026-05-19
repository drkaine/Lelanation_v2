/**
 * Fusionne `objective_outcome_histogram` region = GLOBAL vers euw1, puis supprime GLOBAL.
 * SQL : backend/scripts/sql/merge_objective_outcome_histogram_global_into_euw1.sql
 *
 * Connexion : `DATABASE_URL` → `lelanation_statistiques`.
 *
 * Usage : npm run script:merge-objective-histogram-global
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveStatistiquesUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('Missing DATABASE_URL (lelanation_statistiques).');
  }
  return url;
}

async function main(): Promise<void> {
  const sqlPath = join(__dirname, "../../scripts/sql/merge_objective_outcome_histogram_global_into_euw1.sql");
  const body = await readFile(sqlPath, "utf8");
  const url = resolveStatistiquesUrl();
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(body);
    console.info("[merge-objective-histogram-global] OK:", sqlPath);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[merge-objective-histogram-global] failed:", err);
  process.exitCode = 1;
});
