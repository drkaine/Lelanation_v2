/**
 * Verrou d'agrégation partagé (Redis) entre le batch du poller et la réagrégation complète
 * (recalcul OTP nocturne, script manuel). Deux écrivains concurrents sur les tables d'agrégats
 * provoquaient des deadlocks et des `match_already_processed` (27/11 : 377 + 3 417).
 */
import { randomUUID } from "crypto";

export const AGGREGATION_LOCK_KEY = "lelanation:aggregation:lock";
const DEFAULT_TTL_MS = 10 * 60_000;
const DEFAULT_POLL_MS = 5_000;

export interface LockStore {
  /** SET NX avec TTL ; true si pris. */
  acquire(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Prolonge le TTL si `value` détient encore le verrou. */
  renew(key: string, value: string, ttlMs: number): Promise<boolean>;
  /** Libère seulement si `value` détient le verrou. */
  release(key: string, value: string): Promise<void>;
}

export interface LockOptions {
  /** 0 (défaut) : ne pas attendre, sauter si tenu. */
  waitMs?: number;
  pollMs?: number;
  ttlMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export type LockResult<T> = { ran: true; value: T } | { ran: false };

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withAggregationLock<T>(
  store: LockStore,
  owner: string,
  fn: (renew: () => Promise<boolean>) => Promise<T>,
  options: LockOptions = {},
): Promise<LockResult<T>> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const waitMs = options.waitMs ?? 0;
  const sleep = options.sleep ?? defaultSleep;
  const value = `${owner}:${randomUUID()}`;

  let waited = 0;
  while (!(await store.acquire(AGGREGATION_LOCK_KEY, value, ttlMs))) {
    if (waited >= waitMs) return { ran: false };
    await sleep(pollMs);
    waited += pollMs;
  }
  try {
    return {
      ran: true,
      value: await fn(() => store.renew(AGGREGATION_LOCK_KEY, value, ttlMs)),
    };
  } finally {
    await store.release(AGGREGATION_LOCK_KEY, value);
  }
}

const RENEW_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("pexpire", KEYS[1], ARGV[2]) else return 0 end`;
const RELEASE_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

interface RedisLike {
  set(
    key: string,
    value: string,
    px: "PX",
    ttl: number,
    nx: "NX",
  ): Promise<string | null>;
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

export function redisLockStore(redis: RedisLike): LockStore {
  return {
    async acquire(key, value, ttlMs) {
      return (await redis.set(key, value, "PX", ttlMs, "NX")) === "OK";
    },
    async renew(key, value, ttlMs) {
      return Number(await redis.eval(RENEW_LUA, 1, key, value, ttlMs)) === 1;
    },
    async release(key, value) {
      await redis.eval(RELEASE_LUA, 1, key, value);
    },
  };
}
