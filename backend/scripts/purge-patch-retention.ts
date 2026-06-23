import "dotenv/config";
import { purgeStaleRankHistory } from "../src/services/patch-retention-cleanup.js";

const result = await purgeStaleRankHistory();
console.log("[purge-patch-retention]", result);
process.exit(0);
