/**
 * Vide les tables d'agrégats puis ré-agrège tous les matchs depuis matchs / teams / participants.
 * Utile après changement du pipeline normalisé (2026-06-22) ou correction du mapping objectives.
 *
 * Usage: DATABASE_URL=... tsx src/scripts/reaggregateAllMatches.ts
 */
import { reaggregateAllMatches } from "../services/reaggregateAll.js";

reaggregateAllMatches((line) => console.log(`[reaggregate] ${line}`))
  .then((total) => console.log(`[reaggregate] done total_aggregated=${total}`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
