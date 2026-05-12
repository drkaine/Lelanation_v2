#!/usr/bin/env python3
"""
Régénère backend/drizzle/migrations/0001_statistiques_partition_by_patch.sql
à partir du fichier SQL source à la racine du repo (nom littéral :
  CREATE TABLE botlane_duo_vs_duo_stats (.sql
).
- Toutes les tables sauf `players` : PARTITION BY LIST (patch) + partition DEFAULT.
- Corrige processed_matches (riot_match_id NOT NULL, une seule PK composite).
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "CREATE TABLE botlane_duo_vs_duo_stats (.sql"
OUT = REPO / "backend/drizzle/migrations/0001_statistiques_partition_by_patch.sql"

ALL_TABLES = [
    "botlane_duo_vs_duo_stats",
    "champion_spell_stats",
    "champion_duo_role_stats",
    "champion_item_set_stats",
    "champion_item_solo_stats",
    "champion_bucket",
    "champion_pick_order",
    "champion_stats",
    "champion_runes_solo_stats",
    "champion_runes_stats",
    "champion_shard_solo_stats",
    "champion_tier_daily_snapshots",
    "champion_bans_by_banner",
    "champion_summoner_spell_pair_stats",
    "champion_summoner_spells",
    "champion_vs_stats",
    "match_outcome_stats",
    "objective_outcome_histogram",
    "processed_matches",
    "team_core_stat",
]


def main() -> None:
    text = SRC.read_text()
    lines: list[str] = []
    for line in text.splitlines():
        if line.strip().startswith("PGPASSWORD="):
            break
        lines.append(line)
    text = "\n".join(lines) + "\n"

    text = text.replace(
        "riot_match_id           TEXT        PRIMARY KEY,\n  game_date",
        "riot_match_id           TEXT        NOT NULL,\n  game_date",
    )

    parts = re.split(r"(?=^(?:CREATE TABLE|CREATE INDEX|CREATE OR REPLACE FUNCTION))", text, flags=re.MULTILINE)
    chunks = [p.strip() for p in parts if p.strip()]

    out_tables: list[str] = []
    out_indexes: list[str] = []
    out_funcs: list[str] = []

    for chunk in chunks:
        if chunk.startswith("CREATE TABLE"):
            m = re.match(r"CREATE TABLE\s+(\w+)\s*\(", chunk, re.S)
            if not m:
                raise SystemExit(f"Table name introuvable: {chunk[:120]!r}")
            tname = m.group(1)
            if tname == "players":
                out_tables.append(chunk.replace("CREATE TABLE players", "CREATE TABLE IF NOT EXISTS players", 1))
                continue
            if not chunk.rstrip().endswith(");"):
                raise SystemExit(f"Table {tname}: fin ); attendue")
            core = chunk.rstrip()[:-2].rstrip()
            out_tables.append(core + "\n) PARTITION BY LIST (patch);\n")
            out_tables.append(f"CREATE TABLE {tname}_p_default PARTITION OF {tname} DEFAULT;\n")
        elif chunk.startswith("CREATE INDEX"):
            out_indexes.append(chunk)
        elif chunk.startswith("CREATE OR REPLACE FUNCTION"):
            out_funcs.append(chunk)
        else:
            raise SystemExit(f"Bloc inconnu: {chunk[:80]!r}")

    drops = "\n".join(f"DROP TABLE IF EXISTS {t} CASCADE;" for t in ALL_TABLES)

    header = """-- Partition LIST(patch) pour toutes les tables agrégées sauf `players`.
-- Généré par scripts/regenerate_statistiques_partition_migration.py
-- Idempotent : DROP des tables agrégées puis CREATE partitionnés.

"""

    full = (
        header
        + drops
        + "\n\n"
        + "\n".join(out_tables)
        + "\n"
        + "\n".join(out_indexes)
        + "\n"
        + "\n".join(out_funcs)
        + "\n"
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(full)
    print(f"Wrote {OUT} ({len(full.splitlines())} lines)")


if __name__ == "__main__":
    main()
