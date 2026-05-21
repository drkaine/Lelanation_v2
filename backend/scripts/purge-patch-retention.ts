import "dotenv/config";
import { purgeStaleProcessedMatchesAndRankHistory } from "../src/services/patch-retention-cleanup.js";

const result = await purgeStaleProcessedMatchesAndRankHistory();
console.log("[purge-patch-retention]", result);
process.exit(0);
