/**
 * Helper générique d'upsert additif batché (sans I/O), partagé par l'ingestion.
 *
 * Beaucoup d'agrégats suivent le même motif : une ligne source par unité (ex.
 * participant, participant×item), une clé de conflit, et des colonnes purement
 * additives (`col = table.col + EXCLUDED.col`). Historiquement chaque unité était
 * upsertée séquentiellement (des dizaines d'allers-retours SQL par match).
 *
 * Ce helper pré-agrège en mémoire par clé de conflit (indispensable pour un INSERT
 * multi-lignes `ON CONFLICT DO UPDATE` : Postgres refuse d'affecter deux fois la
 * même ligne dans un même statement) puis construit un unique INSERT paramétré.
 * Le résultat est strictement équivalent aux upserts additifs successifs.
 */
export type AdditiveUpsertRow = {
  /** Valeurs des colonnes de clé (mêmes colonnes/ordre que `keyColumns`). */
  keys: unknown[];
  /** Valeurs des colonnes additives (mêmes colonnes/ordre que `sumColumns`). */
  sums: number[];
};

export type AdditiveUpsertConfig = {
  table: string;
  /** Colonnes formant la clé de conflit (ordre = `ON CONFLICT (...)`). */
  keyColumns: string[];
  /** Colonnes additionnées (`col = table.col + EXCLUDED.col`). */
  sumColumns: string[];
  rows: AdditiveUpsertRow[];
  /** Ajoute `updated_at = NOW()` au DO UPDATE (seulement si la table a la colonne). */
  touchUpdatedAt?: boolean;
};

export type BuiltUpsert = { query: string; params: unknown[] };

export function buildAdditiveUpsertSql(config: AdditiveUpsertConfig): BuiltUpsert | null {
  const { table, keyColumns, sumColumns, rows } = config;

  const aggregated = new Map<string, AdditiveUpsertRow>();
  for (const row of rows) {
    if (row.keys.length !== keyColumns.length || row.sums.length !== sumColumns.length) {
      throw new Error(
        `buildAdditiveUpsertSql(${table}): row shape mismatch ` +
          `(keys ${row.keys.length}/${keyColumns.length}, sums ${row.sums.length}/${sumColumns.length})`,
      );
    }
    const key = row.keys.map((v) => String(v)).join("\u0001");
    const existing = aggregated.get(key);
    if (existing) {
      for (let i = 0; i < sumColumns.length; i++) existing.sums[i]! += row.sums[i]!;
    } else {
      aggregated.set(key, { keys: row.keys, sums: [...row.sums] });
    }
  }

  if (aggregated.size === 0) return null;

  const allCols = [...keyColumns, ...sumColumns];
  const params: unknown[] = [];
  const valueTuples = [...aggregated.values()].map((r) => {
    const tuple = [...r.keys, ...r.sums];
    const start = params.length;
    for (const value of tuple) params.push(value);
    return `(${tuple.map((_, i) => `$${start + i + 1}`).join(", ")})`;
  });

  const updateParts = sumColumns.map((c) => `${c} = ${table}.${c} + EXCLUDED.${c}`);
  if (config.touchUpdatedAt) updateParts.push("updated_at = NOW()");

  const query =
    `INSERT INTO ${table} (${allCols.join(", ")}) ` +
    `VALUES ${valueTuples.join(", ")} ` +
    `ON CONFLICT (${keyColumns.join(", ")}) DO UPDATE SET ${updateParts.join(", ")}`;

  return { query, params };
}

/** Exécute l'upsert additif batché sur la transaction fournie (no-op si aucune ligne). */
export async function runAdditiveUpsert(
  tx: { unsafe: (query: string, params?: unknown[]) => Promise<unknown> },
  config: AdditiveUpsertConfig,
): Promise<void> {
  const built = buildAdditiveUpsertSql(config);
  if (!built) return;
  await tx.unsafe(built.query, built.params);
}
