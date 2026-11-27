import { describe, expect, it } from "vitest";
import {
  AGGREGATION_LOCK_KEY,
  withAggregationLock,
  type LockStore,
} from "../../../../src/services/aggregationLock.js";

/** Store mémoire : SET NX + TTL ignoré, comparaison du propriétaire. */
function memoryStore(): LockStore & { owner: () => string | null; renewals: number } {
  let holder: string | null = null;
  const store = {
    renewals: 0,
    owner: () => holder,
    async acquire(_key: string, value: string) {
      if (holder !== null) return false;
      holder = value;
      return true;
    },
    async renew(_key: string, value: string) {
      store.renewals += 1;
      return holder === value;
    },
    async release(_key: string, value: string) {
      if (holder === value) holder = null;
    },
  };
  return store;
}

const noSleep = async () => {};

describe("withAggregationLock (batch poller ⟂ réagrégation complète)", () => {
  it("libre → exécute puis libère", async () => {
    const store = memoryStore();
    const res = await withAggregationLock(store, "poller", async () => 42, { sleep: noSleep });
    expect(res).toEqual({ ran: true, value: 42 });
    expect(store.owner()).toBeNull();
  });

  it("tenu + sans attente → n'exécute pas (batch poller sauté)", async () => {
    const store = memoryStore();
    await store.acquire(AGGREGATION_LOCK_KEY, "reaggregate", 1000);
    let called = false;
    const res = await withAggregationLock(store, "poller", async () => {
      called = true;
    }, { sleep: noSleep });
    expect(res).toEqual({ ran: false });
    expect(called).toBe(false);
    expect(store.owner()).toBe("reaggregate");
  });

  it("tenu + attente → attend la libération puis exécute", async () => {
    const store = memoryStore();
    await store.acquire(AGGREGATION_LOCK_KEY, "poller", 1000);
    let waits = 0;
    const res = await withAggregationLock(store, "reaggregate", async () => "ok", {
      waitMs: 10_000,
      pollMs: 1000,
      sleep: async () => {
        waits += 1;
        if (waits === 3) await store.release(AGGREGATION_LOCK_KEY, "poller");
      },
    });
    expect(res).toEqual({ ran: true, value: "ok" });
    expect(waits).toBe(3);
  });

  it("attente dépassée → n'exécute pas", async () => {
    const store = memoryStore();
    await store.acquire(AGGREGATION_LOCK_KEY, "poller", 1000);
    const res = await withAggregationLock(store, "reaggregate", async () => "x", {
      waitMs: 3000,
      pollMs: 1000,
      sleep: noSleep,
    });
    expect(res).toEqual({ ran: false });
  });

  it("erreur dans fn → verrou libéré, erreur propagée", async () => {
    const store = memoryStore();
    await expect(
      withAggregationLock(store, "poller", async () => {
        throw new Error("boom");
      }, { sleep: noSleep }),
    ).rejects.toThrow("boom");
    expect(store.owner()).toBeNull();
  });

  it("travail long → TTL renouvelé via le callback renew", async () => {
    const store = memoryStore();
    const res = await withAggregationLock(store, "reaggregate", async (renew) => {
      await renew();
      await renew();
      return "done";
    }, { sleep: noSleep });
    expect(res).toEqual({ ran: true, value: "done" });
    expect(store.renewals).toBe(2);
  });

  it("propriétaires distincts : valeur unique par prise (pas de libération croisée)", async () => {
    const store = memoryStore();
    let seen: string | null = null;
    await withAggregationLock(store, "poller", async () => {
      seen = store.owner();
    }, { sleep: noSleep });
    expect(seen).toMatch(/^poller:/);
  });
});
