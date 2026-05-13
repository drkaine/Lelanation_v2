/**
 * Placeholder : le Makefile référence encore `make copy-stats-statistiques`.
 * La copie bulk Prisma → Drizzle n’est pas implémentée ici ; le poller v2 ingère
 * directement dans la base pointée par `DATABASE_URL`.
 *
 * Pour fusionner `objective_outcome_histogram` GLOBAL → euw1 :
 *   npm run script:merge-objective-histogram-global
 */
import "dotenv/config";

async function main(): Promise<void> {
  const syncOnly = process.argv.includes("--sync-players-only");
  console.error(
    syncOnly
      ? "[copy-stats-statistiques] --sync-players-only : non implémenté dans ce dépôt."
      : "[copy-stats-statistiques] Non implémenté. Histogramme GLOBAL→euw1 : npm run script:merge-objective-histogram-global",
  );
  process.exitCode = 1;
}

void main();
