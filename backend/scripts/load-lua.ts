import { loadLuaScript } from "../src/redis/rate-scheduler.js";
import { redis } from "../src/redis/client.js";

async function main(): Promise<void> {
  try {
    await loadLuaScript();
    console.log("Lua rate-limiter script loaded successfully.");
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error("Failed to load Lua rate-limiter script:", error);
  process.exitCode = 1;
});
