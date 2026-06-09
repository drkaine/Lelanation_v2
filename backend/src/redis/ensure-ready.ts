import { waitForRedis } from "./client.js";

await waitForRedis();
console.log("[redis] ready");
