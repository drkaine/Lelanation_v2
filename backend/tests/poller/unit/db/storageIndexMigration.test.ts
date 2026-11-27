import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../../../drizzle/migrations");
const sql = readFileSync(join(dir, "0053_storage_indexes.sql"), "utf8");
const journal = JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as {
  entries: { idx: number; tag: string }[];
};

describe("migration 0053 : index redondants (stockage)", () => {
  it("est au journal", () => {
    expect(journal.entries.find((e) => e.idx === 53)?.tag).toBe("0053_storage_indexes");
  });

  it("PK rank_history en (puuid, region, date) puis supprime l'index lookup doublon", () => {
    expect(sql).toMatch(/\(puuid, region, date\)/);
    // verrou pris d'abord : sinon SHARE (index) → ACCESS EXCLUSIVE (PK) = deadlock avec les inserts du poller
    expect(sql.indexOf("LOCK TABLE player_rank_history IN ACCESS EXCLUSIVE MODE")).toBeGreaterThan(-1);
    expect(sql.indexOf("LOCK TABLE")).toBeLessThan(sql.indexOf("CREATE UNIQUE INDEX"));
    expect(sql).toMatch(/PRIMARY KEY USING INDEX/);
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_rank_history_lookup/);
  });

  it("supprime last_seen DESC NULLS LAST (= parcours inverse de ASC NULLS FIRST)", () => {
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_players_last_seen_desc/);
    expect(sql).not.toMatch(/DROP INDEX IF EXISTS idx_players_last_seen_asc_nulls_first/);
  });
});
