/**
 * Copie les données de `lelanation_stats` (DATABASE_URL) vers `lelanation_statistiques`
 * (DATABASE_URL_STATISTIQUES). Colonnes absentes côté source : 0 ou littéraux.
 *
 * Tables : players, botlane_duo_vs_duo_stats, champion_vs_stats, champion_spell_stats,
 * champion_duo_role_stats, team_core_stat, champion_tier_daily_snapshots, champion_stats
 * (sous-ensemble agg core, team=100), match_outcome_stats, processed_matches,
 * champion_bans_by_banner (pivot team_num + rôle bannière), objective_outcome_histogram
 * (agg_team_bucket + clés non numériques des jsonb agg_objective_outcome_stats).
 * Union `agg_*` ∪ `archive_agg_*` quand l’archive existe.
 *
 *   npx tsx src/scripts/copyStatsToStatistiquesDb.ts
 *   npx tsx src/scripts/copyStatsToStatistiquesDb.ts --replace [--keep-players] [--skip-players]
 *   npx tsx src/scripts/copyStatsToStatistiquesDb.ts --replace --from=botlane_duo_vs_duo_stats
 *     (reprise : ne tronque ni ne recopie players ; TRUNCATE + copie depuis cette table ; --from exige --replace)
 *   npx tsx src/scripts/copyStatsToStatistiquesDb.ts --sync-players-only
 *     (re-copie uniquement players : upsert keyset depuis la source, sans toucher aux autres tables)
 *   idem avec --truncate-dest-players pour TRUNCATE players sur la cible avant copie (alignement exact des effectifs).
 *
 * Ne pas faire `source .env` (lignes non KEY=value cassent le shell). `dotenv` charge backend/.env.
 * Gros volume players : pagination keyset sur `puuid` (évite dérives OFFSET si la table source grandit).
 * Repasses d’alignement COUNT : même scan source, mais `SELECT puuid … WHERE puuid = ANY(lot)` sur la cible
 * pour n’upsert que les puuids absents (pas de réécriture de ~1,5 M lignes déjà à jour).
 * Optionnellement PGOPTIONS='-c synchronous_commit=off' côté cible pour accélérer.
 */
import 'dotenv/config'
import pg from 'pg'

const BATCH = 2500
/** Limite prudente de paramètres $1..$n par requête (pg / serveur, souvent ~32767–65535). */
const PG_MAX_BIND_PARAMS = 30000
const TEAM_STATS = 100
const REGION_GLOBAL = 'GLOBAL'
const PATCH_SNAPSHOT = 'migrated'

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`${name} must be set (see backend/.env.example)`)
  return v
}

async function tableExists(client: pg.Pool, rel: string): Promise<boolean> {
  const r = await client.query<{ e: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r','p')
    ) AS e`,
    [rel],
  )
  return Boolean(r.rows[0]?.e)
}

/** `--from=table` ou `--from table` : nom de table cible (ex. botlane_duo_vs_duo_stats). */
function parseCopyFromTable(): string | undefined {
  for (const a of process.argv) {
    if (a.startsWith('--from=')) {
      const v = a.slice('--from='.length).trim()
      return v || undefined
    }
  }
  const i = process.argv.indexOf('--from')
  if (i >= 0) {
    const next = process.argv[i + 1]
    if (next && !next.startsWith('-')) return next.trim()
  }
  return undefined
}

/** Ordre des étapes de copie (= ordre logique du script). */
const COPY_STEP_ORDER = [
  'players',
  'botlane_duo_vs_duo_stats',
  'champion_vs_stats',
  'champion_spell_stats',
  'champion_duo_role_stats',
  'team_core_stat',
  'champion_bans_by_banner',
  'objective_outcome_histogram',
  'champion_tier_daily_snapshots',
  'champion_stats',
  'match_outcome_stats',
  'processed_matches',
] as const

type CopyStep = (typeof COPY_STEP_ORDER)[number]

/** Tables vidées au --replace (hors players), même ordre que TRUNCATE actuel. */
const STATS_TRUNC_ORDER = [
  'botlane_duo_vs_duo_stats',
  'champion_vs_stats',
  'champion_spell_stats',
  'champion_duo_role_stats',
  'team_core_stat',
  'champion_tier_daily_snapshots',
  'champion_stats',
  'match_outcome_stats',
  'processed_matches',
  'objective_outcome_histogram',
  'champion_bans_by_banner',
  'champion_bucket',
  'champion_item_set_stats',
  'champion_item_solo_stats',
  'champion_pick_order',
  'champion_runes_solo_stats',
  'champion_runes_stats',
  'champion_shard_solo_stats',
  'champion_summoner_spell_pair_stats',
  'champion_summoner_spells',
] as const

function placeholdersBlock(rowCount: number, colCount: number): { text: string; next: number } {
  let n = 0
  const chunks: string[] = []
  for (let r = 0; r < rowCount; r++) {
    const ph = Array.from({ length: colCount }, () => `$${++n}`)
    chunks.push(`(${ph.join(', ')})`)
  }
  return { text: chunks.join(', '), next: n }
}

async function insertMappedBatches(
  src: pg.Pool,
  dst: pg.Pool,
  label: string,
  countSql: string,
  pageSql: (lim: number, off: number) => string,
  insertPrefix: string,
  onConflictSql: string,
  colCount: number,
  mapRow: (r: Record<string, unknown>) => unknown[],
  batchSize: number = BATCH,
): Promise<void> {
  const effBatch = Math.min(batchSize, Math.max(1, Math.floor(PG_MAX_BIND_PARAMS / Math.max(1, colCount))))
  if (effBatch < batchSize) {
    console.log(
      `[${label}] batch ${batchSize}→${effBatch} lignes (≤${PG_MAX_BIND_PARAMS} paramètres / ${colCount} colonnes)`,
    )
  }
  const c = await src.query<{ n: string }>(countSql)
  const total = parseInt(c.rows[0]?.n ?? '0', 10)
  console.log(`[${label}] ${total} rows (batch ${effBatch})`)
  let done = 0
  for (let offset = 0; offset < total; offset += effBatch) {
    const { rows } = await src.query(pageSql(effBatch, offset))
    if (rows.length === 0) break
    const flat = (rows as Record<string, unknown>[]).flatMap(mapRow)
    const { text, next } = placeholdersBlock(rows.length, colCount)
    if (next !== flat.length) throw new Error(`${label}: placeholder ${next} vs values ${flat.length}`)
    await dst.query(`${insertPrefix} VALUES ${text} ${onConflictSql}`, flat)
    done += rows.length
    process.stdout.write(`\r[${label}] ${done}/${total}`)
    if (rows.length < effBatch) break
  }
  if (total > 0) process.stdout.write('\n')
}

/** Copie `players` en pages par curseur (puuid) : stable si des lignes sont insérées en cours de route ; évite done > COUNT avec OFFSET. */
async function insertMappedPlayersKeyset(
  src: pg.Pool,
  dst: pg.Pool,
  insertPrefix: string,
  onConflictSql: string,
  mapRow: (r: Record<string, unknown>) => unknown[],
  batchSize: number = 3500,
): Promise<void> {
  const colCount = 12
  const effBatch = Math.min(batchSize, Math.max(1, Math.floor(PG_MAX_BIND_PARAMS / colCount)))
  if (effBatch < batchSize) {
    console.log(
      `[players] batch ${batchSize}→${effBatch} lignes (≤${PG_MAX_BIND_PARAMS} paramètres / ${colCount} colonnes)`,
    )
  }
  const c = await src.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`)
  const totalAtStart = parseInt(c.rows[0]?.n ?? '0', 10)
  console.log(
    `[players] COUNT début: ${totalAtStart} (pagination keyset ORDER BY puuid, lot ${effBatch})`,
  )
  const selectList = `puuid, game_name, tag_name, region, puuid_key_version, last_seen,
                  rank_tier, rank_division, rank_lp, rank_snapshot_game_date, created_at, updated_at`
  let done = 0
  let lastPuuid: string | null = null

  const countPlayers = async (pool: pg.Pool): Promise<number> => {
    const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`)
    return parseInt(r.rows[0]?.n ?? '0', 10)
  }

  const fetchBatch = () =>
    lastPuuid === null
      ? src.query(`SELECT ${selectList} FROM players ORDER BY puuid ASC LIMIT $1`, [effBatch])
      : src.query(`SELECT ${selectList} FROM players WHERE puuid > $1 ORDER BY puuid ASC LIMIT $2`, [lastPuuid, effBatch])

  const applyBatch = async (rows: Record<string, unknown>[]) => {
    const flat = rows.flatMap(mapRow)
    const { text, next } = placeholdersBlock(rows.length, colCount)
    if (next !== flat.length) throw new Error(`players: placeholder ${next} vs values ${flat.length}`)
    await dst.query(`${insertPrefix} VALUES ${text} ${onConflictSql}`, flat)
    done += rows.length
    const denom = Math.max(totalAtStart, done)
    const tag = done > totalAtStart ? ' [+inserts source]' : ''
    process.stdout.write(`\r[players] ${done}/${denom}${tag}`)
    lastPuuid = String(rows[rows.length - 1]!.puuid)
  }

  /**
   * Même curseur keyset que `applyBatch`, mais upsert uniquement les lignes dont le `puuid`
   * n’existe pas encore sur la cible (anti-join par lot via ANY).
   */
  const applyBatchMissingOnly = async (batchRows: Record<string, unknown>[]) => {
    if (batchRows.length === 0) return
    const puuids = batchRows.map((r) => String(r.puuid))
    const { rows: present } = await dst.query<{ puuid: string }>(
      `SELECT puuid FROM players WHERE puuid = ANY($1::text[])`,
      [puuids],
    )
    const have = new Set(present.map((r) => String(r.puuid)))
    const missing = batchRows.filter((r) => !have.has(String(r.puuid)))
    if (missing.length > 0) {
      const flat = missing.flatMap(mapRow)
      const { text, next } = placeholdersBlock(missing.length, colCount)
      if (next !== flat.length) throw new Error(`players: placeholder ${next} vs values ${flat.length}`)
      await dst.query(`${insertPrefix} VALUES ${text} ${onConflictSql}`, flat)
      done += missing.length
    }
    const denom = Math.max(totalAtStart, done)
    const tag = done > totalAtStart ? ' [+inserts source]' : ''
    process.stdout.write(
      `\r[players] ${done}/${denom}${tag} (repasse diff: ${missing.length}/${batchRows.length})`,
    )
    lastPuuid = String(batchRows[batchRows.length - 1]!.puuid)
  }

  /** Inserts concurrents peuvent insérer un puuid lexicographiquement avant le curseur : repasses depuis le début jusqu'à COUNT alignés. */
  const MAX_RECONCILE_PASSES = 30
  const TAIL_MAX_EXTRA = 50_000
  const TAIL_IDLE_TO_STOP = 3

  for (let reconcilePass = 0; reconcilePass < MAX_RECONCILE_PASSES; reconcilePass++) {
    if (reconcilePass > 0) {
      const s0 = await countPlayers(src)
      const d0 = await countPlayers(dst)
      console.log(
        `\n[players] repasse ${reconcilePass + 1}: COUNT source=${s0} dest=${d0} — keyset + diff puuid (insert manquants)`,
      )
    }

    const applyOne = reconcilePass > 0 ? applyBatchMissingOnly : applyBatch

    for (;;) {
      const { rows } = await fetchBatch()
      if (rows.length === 0) break
      await applyOne(rows as Record<string, unknown>[])
      /** Ne pas arrêter sur lot < effBatch : la table source peut encore grossir (nouveaux puuid > dernier). */
    }

    /** Filet : inserts après lecture vide ; plafond large pour éviter de couper sous charge soutenue. */
    let idleRounds = 0
    for (let extra = 0; extra < TAIL_MAX_EXTRA && idleRounds < TAIL_IDLE_TO_STOP; extra++) {
      const { rows } = await fetchBatch()
      if (rows.length === 0) {
        idleRounds++
        continue
      }
      idleRounds = 0
      await applyOne(rows as Record<string, unknown>[])
    }

    const s = await countPlayers(src)
    const d = await countPlayers(dst)
    if (s === d) {
      if (reconcilePass > 0) {
        console.log(`[players] COUNT source=dest=${s} après ${reconcilePass + 1} passe(s).`)
      }
      break
    }
    if (d > s) {
      console.warn(
        `[players] COUNT dest=${d} > source=${s} : la copie ne supprime pas les lignes absentes de la source. Corrigez la dest ou acceptez l’écart.`,
      )
      break
    }
    if (reconcilePass === MAX_RECONCILE_PASSES - 1) {
      console.warn(
        `[players] COUNT source=${s} dest=${d} après ${MAX_RECONCILE_PASSES} repasses — arrêt (source très volatile ou écart non lié aux inserts). Relancez --sync-players-only ou pausez les écrivains.`,
      )
      break
    }
    lastPuuid = null
  }

  if (totalAtStart > 0 || done > 0) process.stdout.write('\n')

  const nSrcEndN = await countPlayers(src)
  const nDstEndN = await countPlayers(dst)
  if (nSrcEndN !== nDstEndN) {
    console.warn(
      `[players] COUNT source=${nSrcEndN} dest=${nDstEndN}, lignes upsertées (toutes passes)=${done}. Relancez --sync-players-only si la source écrit encore.`,
    )
  }
}

/** Colonnes jsonb win/loss dans agg_objective_outcome_stats ; `base` aligné sur agg_team_bucket.objective_key (void → horde). */
const AGG_OBJECTIVE_JSON_SPECS: ReadonlyArray<{ win: string; loss: string; base: string }> = [
  { win: 'baron_win_team', loss: 'baron_loose_team', base: 'baron' },
  { win: 'drake_win_team', loss: 'drake_loose_team', base: 'drake' },
  { win: 'void_win_team', loss: 'void_loose_team', base: 'horde' },
  { win: 'herald_win_team', loss: 'herald_loose_team', base: 'riftHerald' },
  { win: 'inhibitor_win_team', loss: 'inhibitor_loose_team', base: 'inhibitor' },
  { win: 'tower_win_team', loss: 'tower_loose_team', base: 'tower' },
  { win: 'first_blood_win_team', loss: 'first_blood_loose_team', base: 'first_blood' },
  { win: 'elder_win_team', loss: 'elder_loose_team', base: 'elder' },
  { win: 'earth_drake_win_team', loss: 'earth_drake_loose_team', base: 'earth_drake' },
  { win: 'water_drake_win_team', loss: 'water_drake_loose_team', base: 'water_drake' },
  { win: 'wind_drake_win_team', loss: 'wind_drake_loose_team', base: 'wind_drake' },
  { win: 'fire_drake_win_team', loss: 'fire_drake_loose_team', base: 'fire_drake' },
  { win: 'hextec_drake_win_team', loss: 'hextec_drake_loose_team', base: 'hextec_drake' },
  { win: 'chem_drake_win_team', loss: 'chem_drake_loose_team', base: 'chem_drake' },
  { win: 'earth_soul_win_team', loss: 'earth_soul_loose_team', base: 'earth_soul' },
  { win: 'water_soul_win_team', loss: 'water_soul_loose_team', base: 'water_soul' },
  { win: 'wind_soul_win_team', loss: 'wind_soul_loose_team', base: 'wind_soul' },
  { win: 'fire_soul_win_team', loss: 'fire_soul_loose_team', base: 'fire_soul' },
  { win: 'hextec_soul_win_team', loss: 'hextec_soul_loose_team', base: 'hextec_soul' },
  { win: 'chem_soul_win_team', loss: 'chem_soul_loose_team', base: 'chem_soul' },
]

function objectiveHistogramTeamBucketGroupedSql(regionGlobal: string, hasArchTeam: boolean, hasArchTb: boolean): string {
  const live = `
    SELECT atc.game_version AS patch, atc.rank_tier, '${regionGlobal}'::text AS region, atc.team::smallint AS team,
           tb.objective_key AS objective_type, 'win'::text AS outcome, tb.objective_bucket::smallint AS obj_count,
           SUM(tb.count_win)::bigint AS count_games
    FROM agg_team_bucket tb
    INNER JOIN agg_team_core_stats atc ON atc.id = tb.team_stat_id
    WHERE UPPER(TRIM(atc.rank_tier)) <> 'UNRANKED'
    GROUP BY atc.game_version, atc.rank_tier, atc.team, tb.objective_key, tb.objective_bucket
    UNION ALL
    SELECT atc.game_version AS patch, atc.rank_tier, '${regionGlobal}'::text AS region, atc.team::smallint AS team,
           tb.objective_key AS objective_type, 'loss'::text AS outcome, tb.objective_bucket::smallint AS obj_count,
           SUM((tb.count_game - tb.count_win)::bigint) AS count_games
    FROM agg_team_bucket tb
    INNER JOIN agg_team_core_stats atc ON atc.id = tb.team_stat_id
    WHERE UPPER(TRIM(atc.rank_tier)) <> 'UNRANKED'
    GROUP BY atc.game_version, atc.rank_tier, atc.team, tb.objective_key, tb.objective_bucket
  `
  if (!hasArchTeam || !hasArchTb) return live
  return `${live}
    UNION ALL
    SELECT atc.game_version AS patch, atc.rank_tier, '${regionGlobal}'::text AS region, atc.team::smallint AS team,
           tb.objective_key AS objective_type, 'win'::text AS outcome, tb.objective_bucket::smallint AS obj_count,
           SUM(tb.count_win)::bigint AS count_games
    FROM archive_agg_team_bucket tb
    INNER JOIN archive_agg_team_core_stats atc ON atc.id = tb.team_stat_id
    WHERE UPPER(TRIM(atc.rank_tier)) <> 'UNRANKED'
    GROUP BY atc.game_version, atc.rank_tier, atc.team, tb.objective_key, tb.objective_bucket
    UNION ALL
    SELECT atc.game_version AS patch, atc.rank_tier, '${regionGlobal}'::text AS region, atc.team::smallint AS team,
           tb.objective_key AS objective_type, 'loss'::text AS outcome, tb.objective_bucket::smallint AS obj_count,
           SUM((tb.count_game - tb.count_win)::bigint) AS count_games
    FROM archive_agg_team_bucket tb
    INNER JOIN archive_agg_team_core_stats atc ON atc.id = tb.team_stat_id
    WHERE UPPER(TRIM(atc.rank_tier)) <> 'UNRANKED'
    GROUP BY atc.game_version, atc.rank_tier, atc.team, tb.objective_key, tb.objective_bucket
  `
}

/** Clés json non numériques (ex. first, soul) : agrégat patch/tier sans côté ; team=100 convention, pas de double comptage avec les lignes par bucket numérique issues de agg_team_bucket. */
function objectiveHistogramAggObjectiveSupplementalSql(regionGlobal: string): string {
  const mk = (col: string, base: string, outcome: 'win' | 'loss') => `
    SELECT ao.game_version AS patch, ao.rank_tier, '${regionGlobal}'::text AS region, 100::smallint AS team,
           ('${base}' || ':' || kv.key) AS objective_type,
           '${outcome}'::text AS outcome, 1::smallint AS obj_count,
           0::bigint AS sum_timestamp_ms,
           GREATEST(0, FLOOR(COALESCE(NULLIF(trim(kv.value::text), '')::numeric, 0)))::int AS count_games,
           NOW() AS updated_at
    FROM agg_objective_outcome_stats ao,
    LATERAL jsonb_each_text(COALESCE(ao.${col}::jsonb, '{}'::jsonb)) AS kv(key, value)
    WHERE UPPER(TRIM(ao.rank_tier)) <> 'UNRANKED'
      AND kv.key !~ '^[0-9]+$'
      AND COALESCE(NULLIF(trim(kv.value::text), '')::numeric, 0) > 0
  `
  const parts: string[] = []
  for (const s of AGG_OBJECTIVE_JSON_SPECS) {
    parts.push(mk(s.win, s.base, 'win'))
  }
  for (const s of AGG_OBJECTIVE_JSON_SPECS) {
    parts.push(mk(s.loss, s.base, 'loss'))
  }
  return parts.join('\n    UNION ALL\n')
}

async function copyObjectiveOutcomeHistogram(
  src: pg.Pool,
  dst: pg.Pool,
  hasArchTeam: boolean,
  hasArchTb: boolean,
): Promise<void> {
  const tbGrouped = objectiveHistogramTeamBucketGroupedSql(REGION_GLOBAL, hasArchTeam, hasArchTb)
  const rollup = `
    SELECT patch, rank_tier, region, team, objective_type, outcome, obj_count,
           SUM(count_games)::int AS count_games,
           0::bigint AS sum_timestamp_ms,
           NOW() AS updated_at
    FROM (${tbGrouped}) u
    GROUP BY patch, rank_tier, region, team, objective_type, outcome, obj_count
  `
  const countSql = `SELECT COUNT(*)::text AS n FROM (${rollup}) t`
  const histCols = `patch, rank_tier, region, team, objective_type, outcome, obj_count, count_games, sum_timestamp_ms, updated_at`
  const onConflict = `ON CONFLICT (patch, rank_tier, region, team, objective_type, outcome, obj_count) DO UPDATE SET
    count_games = EXCLUDED.count_games,
    sum_timestamp_ms = EXCLUDED.sum_timestamp_ms,
    updated_at = EXCLUDED.updated_at`
  await insertMappedBatches(
    src,
    dst,
    'objective_outcome_histogram (team_bucket)',
    countSql,
    (lim, off) =>
      `SELECT * FROM (${rollup}) t ORDER BY patch, rank_tier, region, team, objective_type, outcome, obj_count LIMIT ${lim} OFFSET ${off}`,
    `INSERT INTO objective_outcome_histogram (${histCols})`,
    onConflict,
    10,
    (r) => [
      r.patch,
      r.rank_tier,
      r.region,
      r.team,
      r.objective_type,
      r.outcome,
      r.obj_count,
      r.count_games,
      r.sum_timestamp_ms,
      r.updated_at,
    ],
  )

  if (!(await tableExists(src, 'agg_objective_outcome_stats'))) return
  const sup = objectiveHistogramAggObjectiveSupplementalSql(REGION_GLOBAL)
  const supRoll = `SELECT patch, rank_tier, region, team, objective_type, outcome, obj_count,
    SUM(count_games)::int AS count_games, MAX(sum_timestamp_ms)::bigint AS sum_timestamp_ms, MAX(updated_at) AS updated_at
    FROM (${sup}) s
    GROUP BY patch, rank_tier, region, team, objective_type, outcome, obj_count`
  const supCount = `SELECT COUNT(*)::text AS n FROM (${supRoll}) c`
  await insertMappedBatches(
    src,
    dst,
    'objective_outcome_histogram (agg_objective jsonb)',
    supCount,
    (lim, off) =>
      `SELECT * FROM (${supRoll}) t ORDER BY patch, rank_tier, region, team, objective_type, outcome, obj_count LIMIT ${lim} OFFSET ${off}`,
    `INSERT INTO objective_outcome_histogram (${histCols})`,
    onConflict,
    10,
    (r) => [
      r.patch,
      r.rank_tier,
      r.region,
      r.team,
      r.objective_type,
      r.outcome,
      r.obj_count,
      r.count_games,
      r.sum_timestamp_ms,
      r.updated_at,
    ],
  )
}

async function main(): Promise<void> {
  const replace = process.argv.includes('--replace')
  const syncPlayersOnly = process.argv.includes('--sync-players-only')
  const truncateDestPlayers = process.argv.includes('--truncate-dest-players')
  const keepPlayers = process.argv.includes('--keep-players')
  const skipPlayers = process.argv.includes('--skip-players')

  const src = new pg.Pool({ connectionString: requireEnv('DATABASE_URL'), max: 4 })
  const dst = new pg.Pool({ connectionString: requireEnv('DATABASE_URL_STATISTIQUES'), max: 4 })

  const hasArchBot = await tableExists(src, 'archive_agg_botlane_duo_vs_duo_stats')
  const hasArchVs = await tableExists(src, 'archive_agg_champion_vs_stats')
  const hasArchCore = await tableExists(src, 'archive_agg_champion_core_stats')
  const hasArchSpell = await tableExists(src, 'archive_agg_champion_spells_stats')
  const hasArchDuo = await tableExists(src, 'archive_agg_champion_duo_role_stats')
  const hasArchTeam = await tableExists(src, 'archive_agg_team_core_stats')
  const hasArchMo = await tableExists(src, 'archive_agg_match_outcome_stats')
  const hasArchBans = await tableExists(src, 'archive_agg_champion_bans_by_banner')
  const hasArchTb = await tableExists(src, 'archive_agg_team_bucket')

  const unionBot = hasArchBot
    ? `SELECT * FROM agg_botlane_duo_vs_duo_stats UNION ALL SELECT * FROM archive_agg_botlane_duo_vs_duo_stats`
    : `SELECT * FROM agg_botlane_duo_vs_duo_stats`

  const unionCore = hasArchCore
    ? `SELECT * FROM agg_champion_core_stats UNION ALL SELECT * FROM archive_agg_champion_core_stats`
    : `SELECT * FROM agg_champion_core_stats`

  const unionVs = hasArchVs
    ? `SELECT * FROM agg_champion_vs_stats UNION ALL SELECT * FROM archive_agg_champion_vs_stats`
    : `SELECT * FROM agg_champion_vs_stats`

  const unionSpell = hasArchSpell
    ? `SELECT * FROM agg_champion_spells_stats UNION ALL SELECT * FROM archive_agg_champion_spells_stats`
    : `SELECT * FROM agg_champion_spells_stats`

  const unionDuo = hasArchDuo
    ? `SELECT * FROM agg_champion_duo_role_stats UNION ALL SELECT * FROM archive_agg_champion_duo_role_stats`
    : `SELECT * FROM agg_champion_duo_role_stats`

  const unionTeam = hasArchTeam
    ? `SELECT * FROM agg_team_core_stats UNION ALL SELECT * FROM archive_agg_team_core_stats`
    : `SELECT * FROM agg_team_core_stats`

  const hasLiveMo = await tableExists(src, 'agg_match_outcome_stats')
  const unionMo =
    hasLiveMo && hasArchMo
      ? `SELECT * FROM agg_match_outcome_stats UNION ALL SELECT * FROM archive_agg_match_outcome_stats`
      : hasLiveMo
        ? `SELECT * FROM agg_match_outcome_stats`
        : hasArchMo
          ? `SELECT * FROM archive_agg_match_outcome_stats`
          : ''

  const fromRaw = syncPlayersOnly ? undefined : parseCopyFromTable()
  const fromStep: CopyStep | undefined =
    fromRaw === undefined
      ? undefined
      : (COPY_STEP_ORDER as readonly string[]).includes(fromRaw)
        ? (fromRaw as CopyStep)
        : (() => {
            throw new Error(`--from: table inconnue "${fromRaw}". Valides : ${COPY_STEP_ORDER.join(', ')}`)
          })()
  const copyStartIdx = fromStep === undefined ? 0 : COPY_STEP_ORDER.indexOf(fromStep)
  const shouldCopy = (step: CopyStep): boolean => COPY_STEP_ORDER.indexOf(step) >= copyStartIdx

  console.log('[copyStatsToStatistiquesDb] archives', {
    hasLiveMo,
    hasArchBot,
    hasArchVs,
    hasArchCore,
    hasArchSpell,
    hasArchDuo,
    hasArchTeam,
    hasArchMo,
    hasArchBans,
    hasArchTb,
    from: fromStep ?? null,
    syncPlayersOnly,
  })

  try {
    if (truncateDestPlayers && !syncPlayersOnly) {
      throw new Error('--truncate-dest-players nécessite --sync-players-only')
    }

    if (syncPlayersOnly) {
      if (!(await tableExists(src, 'players'))) throw new Error('Table players absente sur la source (DATABASE_URL)')
      if (!(await tableExists(dst, 'players'))) throw new Error('Table players absente sur la cible (DATABASE_URL_STATISTIQUES)')
      const nBefore = await dst.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`)
      const nSrc = await src.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`)
      console.log(
        `[copyStatsToStatistiquesDb] --sync-players-only: source=${nSrc.rows[0]?.n ?? '?'} dest_avant=${nBefore.rows[0]?.n ?? '?'}`,
      )
      if (truncateDestPlayers) {
        await dst.query('TRUNCATE TABLE players')
        console.log('[copyStatsToStatistiquesDb] TRUNCATE players sur la cible (--truncate-dest-players)')
      }
      await insertMappedPlayersKeyset(
        src,
        dst,
        `INSERT INTO players (
           puuid, game_name, tag_name, region, puuid_key_version, last_seen,
           rank_tier, rank_division, rank_lp, rank_snapshot_game_date, created_at, updated_at
         )`,
        `ON CONFLICT (puuid) DO UPDATE SET
           game_name = EXCLUDED.game_name, tag_name = EXCLUDED.tag_name, region = EXCLUDED.region,
           puuid_key_version = EXCLUDED.puuid_key_version, last_seen = EXCLUDED.last_seen,
           rank_tier = EXCLUDED.rank_tier, rank_division = EXCLUDED.rank_division, rank_lp = EXCLUDED.rank_lp,
           rank_snapshot_game_date = EXCLUDED.rank_snapshot_game_date, updated_at = EXCLUDED.updated_at`,
        (r) => [
          r.puuid,
          r.game_name,
          r.tag_name,
          r.region,
          r.puuid_key_version,
          r.last_seen,
          r.rank_tier,
          r.rank_division,
          r.rank_lp,
          r.rank_snapshot_game_date,
          r.created_at,
          r.updated_at,
        ],
        3500,
      )
      const nAfter = await dst.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`)
      const nSrc2 = await src.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM players`)
      console.log(
        `[copyStatsToStatistiquesDb] --sync-players-only terminé: source=${nSrc2.rows[0]?.n ?? '?'} dest_après=${nAfter.rows[0]?.n ?? '?'}`,
      )
      return
    }

    if (fromStep !== undefined && !replace) {
      throw new Error('Utilisez --replace avec --from=<table> pour tronquer les tables à reprendre (évite les doublons).')
    }

    if (replace) {
      if (fromStep === undefined || fromStep === 'players') {
        await dst.query(`TRUNCATE TABLE ${STATS_TRUNC_ORDER.join(', ')} CASCADE`)
        if (!keepPlayers && !skipPlayers) await dst.query('TRUNCATE TABLE players CASCADE')
      } else {
        const tail = COPY_STEP_ORDER.slice(copyStartIdx).filter((t) => t !== 'players')
        console.log(`[copyStatsToStatistiquesDb] TRUNCATE partiel depuis ${fromStep}: ${tail.join(', ')}`)
        await dst.query(`TRUNCATE TABLE ${tail.join(', ')} CASCADE`)
      }
      console.log(
        '[copyStatsToStatistiquesDb] TRUNCATE ok; players:',
        keepPlayers
          ? 'kept'
          : skipPlayers
            ? 'unchanged (--skip-players)'
            : fromStep && fromStep !== 'players'
              ? 'unchanged (--from)'
              : 'cleared',
      )
    }

    if (shouldCopy('players') && (await tableExists(src, 'players')) && !skipPlayers) {
      await insertMappedPlayersKeyset(
        src,
        dst,
        `INSERT INTO players (
           puuid, game_name, tag_name, region, puuid_key_version, last_seen,
           rank_tier, rank_division, rank_lp, rank_snapshot_game_date, created_at, updated_at
         )`,
        `ON CONFLICT (puuid) DO UPDATE SET
           game_name = EXCLUDED.game_name, tag_name = EXCLUDED.tag_name, region = EXCLUDED.region,
           puuid_key_version = EXCLUDED.puuid_key_version, last_seen = EXCLUDED.last_seen,
           rank_tier = EXCLUDED.rank_tier, rank_division = EXCLUDED.rank_division, rank_lp = EXCLUDED.rank_lp,
           rank_snapshot_game_date = EXCLUDED.rank_snapshot_game_date, updated_at = EXCLUDED.updated_at`,
        (r) => [
          r.puuid,
          r.game_name,
          r.tag_name,
          r.region,
          r.puuid_key_version,
          r.last_seen,
          r.rank_tier,
          r.rank_division,
          r.rank_lp,
          r.rank_snapshot_game_date,
          r.created_at,
          r.updated_at,
        ],
        3500,
      )
    } else if (skipPlayers) {
      console.log('[copyStatsToStatistiquesDb] skip players (--skip-players)')
    }

    if (shouldCopy('botlane_duo_vs_duo_stats')) {
    /** UNION ALL live ∪ archive peut dupliquer la clé naturelle : agrégation avant INSERT pour éviter « ON CONFLICT … row a second time ». */
    const botUnionRows = `
      SELECT b.game_version AS patch, b.rank_tier, b.region, b.adc_id, b.support_id, b.opp_adc_id, b.opp_support_id,
             b.count_win, b.count_game,
             b.sum_adc_gold_earned, b.sum_adc_gold_spent, b.sum_adc_max_level_lead_lane_opponent, b.sum_adc_max_kill_deficit,
             b.sum_adc_max_cs_advantage_on_lane_opponent, b.sum_adc_vision_score_advantage_lane_opponent,
             b.sum_adc_laning_phase_gold_exp_advantage, b.sum_adc_early_laning_phase_gold_exp_advantage,
             0::bigint AS sum_adc_physique_damage_done_to_champion_u15,
             0::bigint AS sum_adc_magic_damage_done_to_champion_u15,
             0::bigint AS sum_adc_true_damage_done_to_champion_u15,
             0::int AS sum_adc_kill_u15, 0::int AS sum_adc_assist_u15, 0::int AS sum_adc_death_u15,
             0::int AS sum_adc_vision_score_u15, 0::bigint AS sum_adc_shield_and_heal_u15, 0::int AS sum_adc_minions_killed_u15,
             b.sum_support_gold_earned, b.sum_support_gold_spent, b.sum_support_max_level_lead_lane_opponent,
             b.sum_support_max_kill_deficit, b.sum_support_max_cs_advantage_on_lane_opponent,
             b.sum_support_vision_score_advantage_lane_opponent, b.sum_support_laning_phase_gold_exp_advantage,
             b.sum_support_early_laning_phase_gold_exp_advantage,
             0::bigint AS sum_support_physique_damage_done_to_champion_u15,
             0::bigint AS sum_support_magic_damage_done_to_champion_u15,
             0::bigint AS sum_support_true_damage_done_to_champion_u15,
             0::int AS sum_support_kill_u15, 0::int AS sum_support_assist_u15, 0::int AS sum_support_death_u15,
             0::int AS sum_support_vision_score_u15, 0::bigint AS sum_support_shield_and_heal_u15, 0::int AS sum_support_minions_killed_u15,
             b.updated_at
      FROM (${unionBot}) b`

    const botInner = `
      SELECT patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id,
             SUM(count_win)::int AS count_win,
             SUM(count_game)::int AS count_game,
             SUM(sum_adc_gold_earned)::bigint AS sum_adc_gold_earned,
             SUM(sum_adc_gold_spent)::bigint AS sum_adc_gold_spent,
             SUM(sum_adc_max_level_lead_lane_opponent)::int AS sum_adc_max_level_lead_lane_opponent,
             SUM(sum_adc_max_kill_deficit)::int AS sum_adc_max_kill_deficit,
             SUM(sum_adc_max_cs_advantage_on_lane_opponent)::int AS sum_adc_max_cs_advantage_on_lane_opponent,
             SUM(sum_adc_vision_score_advantage_lane_opponent)::int AS sum_adc_vision_score_advantage_lane_opponent,
             SUM(sum_adc_laning_phase_gold_exp_advantage)::int AS sum_adc_laning_phase_gold_exp_advantage,
             SUM(sum_adc_early_laning_phase_gold_exp_advantage)::int AS sum_adc_early_laning_phase_gold_exp_advantage,
             SUM(sum_adc_physique_damage_done_to_champion_u15)::bigint AS sum_adc_physique_damage_done_to_champion_u15,
             SUM(sum_adc_magic_damage_done_to_champion_u15)::bigint AS sum_adc_magic_damage_done_to_champion_u15,
             SUM(sum_adc_true_damage_done_to_champion_u15)::bigint AS sum_adc_true_damage_done_to_champion_u15,
             SUM(sum_adc_kill_u15)::int AS sum_adc_kill_u15,
             SUM(sum_adc_assist_u15)::int AS sum_adc_assist_u15,
             SUM(sum_adc_death_u15)::int AS sum_adc_death_u15,
             SUM(sum_adc_vision_score_u15)::int AS sum_adc_vision_score_u15,
             SUM(sum_adc_shield_and_heal_u15)::bigint AS sum_adc_shield_and_heal_u15,
             SUM(sum_adc_minions_killed_u15)::int AS sum_adc_minions_killed_u15,
             SUM(sum_support_gold_earned)::bigint AS sum_support_gold_earned,
             SUM(sum_support_gold_spent)::bigint AS sum_support_gold_spent,
             SUM(sum_support_max_level_lead_lane_opponent)::int AS sum_support_max_level_lead_lane_opponent,
             SUM(sum_support_max_kill_deficit)::int AS sum_support_max_kill_deficit,
             SUM(sum_support_max_cs_advantage_on_lane_opponent)::int AS sum_support_max_cs_advantage_on_lane_opponent,
             SUM(sum_support_vision_score_advantage_lane_opponent)::int AS sum_support_vision_score_advantage_lane_opponent,
             SUM(sum_support_laning_phase_gold_exp_advantage)::int AS sum_support_laning_phase_gold_exp_advantage,
             SUM(sum_support_early_laning_phase_gold_exp_advantage)::int AS sum_support_early_laning_phase_gold_exp_advantage,
             SUM(sum_support_physique_damage_done_to_champion_u15)::bigint AS sum_support_physique_damage_done_to_champion_u15,
             SUM(sum_support_magic_damage_done_to_champion_u15)::bigint AS sum_support_magic_damage_done_to_champion_u15,
             SUM(sum_support_true_damage_done_to_champion_u15)::bigint AS sum_support_true_damage_done_to_champion_u15,
             SUM(sum_support_kill_u15)::int AS sum_support_kill_u15,
             SUM(sum_support_assist_u15)::int AS sum_support_assist_u15,
             SUM(sum_support_death_u15)::int AS sum_support_death_u15,
             SUM(sum_support_vision_score_u15)::int AS sum_support_vision_score_u15,
             SUM(sum_support_shield_and_heal_u15)::bigint AS sum_support_shield_and_heal_u15,
             SUM(sum_support_minions_killed_u15)::int AS sum_support_minions_killed_u15,
             MAX(updated_at) AS updated_at
      FROM (${botUnionRows}) s
      GROUP BY patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id`

    await insertMappedBatches(
      src,
      dst,
      'botlane_duo_vs_duo_stats',
      `SELECT COUNT(*)::text AS n FROM (${botInner}) c`,
      (lim, off) => `${botInner} ORDER BY patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id LIMIT ${lim} OFFSET ${off}`,
      `INSERT INTO botlane_duo_vs_duo_stats (
         patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id,
         count_win, count_game,
         sum_adc_gold_earned, sum_adc_gold_spent, sum_adc_max_level_lead_lane_opponent, sum_adc_max_kill_deficit,
         sum_adc_max_cs_advantage_on_lane_opponent, sum_adc_vision_score_advantage_lane_opponent,
         sum_adc_laning_phase_gold_exp_advantage, sum_adc_early_laning_phase_gold_exp_advantage,
         sum_adc_physique_damage_done_to_champion_u15, sum_adc_magic_damage_done_to_champion_u15, sum_adc_true_damage_done_to_champion_u15,
         sum_adc_kill_u15, sum_adc_assist_u15, sum_adc_death_u15, sum_adc_vision_score_u15, sum_adc_shield_and_heal_u15, sum_adc_minions_killed_u15,
         sum_support_gold_earned, sum_support_gold_spent, sum_support_max_level_lead_lane_opponent, sum_support_max_kill_deficit,
         sum_support_max_cs_advantage_on_lane_opponent, sum_support_vision_score_advantage_lane_opponent,
         sum_support_laning_phase_gold_exp_advantage, sum_support_early_laning_phase_gold_exp_advantage,
         sum_support_physique_damage_done_to_champion_u15, sum_support_magic_damage_done_to_champion_u15, sum_support_true_damage_done_to_champion_u15,
         sum_support_kill_u15, sum_support_assist_u15, sum_support_death_u15, sum_support_vision_score_u15, sum_support_shield_and_heal_u15, sum_support_minions_killed_u15,
         updated_at
       )`,
      `ON CONFLICT (patch, rank_tier, region, adc_id, support_id, opp_adc_id, opp_support_id) DO UPDATE SET
         count_win = EXCLUDED.count_win, count_game = EXCLUDED.count_game, updated_at = EXCLUDED.updated_at`,
      44,
      (r) => [
        r.patch,
        r.rank_tier,
        r.region,
        r.adc_id,
        r.support_id,
        r.opp_adc_id,
        r.opp_support_id,
        r.count_win,
        r.count_game,
        r.sum_adc_gold_earned,
        r.sum_adc_gold_spent,
        r.sum_adc_max_level_lead_lane_opponent,
        r.sum_adc_max_kill_deficit,
        r.sum_adc_max_cs_advantage_on_lane_opponent,
        r.sum_adc_vision_score_advantage_lane_opponent,
        r.sum_adc_laning_phase_gold_exp_advantage,
        r.sum_adc_early_laning_phase_gold_exp_advantage,
        r.sum_adc_physique_damage_done_to_champion_u15,
        r.sum_adc_magic_damage_done_to_champion_u15,
        r.sum_adc_true_damage_done_to_champion_u15,
        r.sum_adc_kill_u15,
        r.sum_adc_assist_u15,
        r.sum_adc_death_u15,
        r.sum_adc_vision_score_u15,
        r.sum_adc_shield_and_heal_u15,
        r.sum_adc_minions_killed_u15,
        r.sum_support_gold_earned,
        r.sum_support_gold_spent,
        r.sum_support_max_level_lead_lane_opponent,
        r.sum_support_max_kill_deficit,
        r.sum_support_max_cs_advantage_on_lane_opponent,
        r.sum_support_vision_score_advantage_lane_opponent,
        r.sum_support_laning_phase_gold_exp_advantage,
        r.sum_support_early_laning_phase_gold_exp_advantage,
        r.sum_support_physique_damage_done_to_champion_u15,
        r.sum_support_magic_damage_done_to_champion_u15,
        r.sum_support_true_damage_done_to_champion_u15,
        r.sum_support_kill_u15,
        r.sum_support_assist_u15,
        r.sum_support_death_u15,
        r.sum_support_vision_score_u15,
        r.sum_support_shield_and_heal_u15,
        r.sum_support_minions_killed_u15,
        r.updated_at,
      ],
    )
    }

    if (shouldCopy('champion_vs_stats')) {
    const vsInner = `
      SELECT c.game_version AS patch, v.role, v.rank_tier, c.region, c.champion_id, v.opponent_champion_id,
             v.count_win, v.count_game,
             v.sum_gold_earned, v.sum_gold_spent, v.sum_max_level_lead_lane_opponent, v.sum_max_kill_deficit,
             v.sum_more_enemy_jungle_than_opponent, v.sum_max_cs_advantage_on_lane_opponent,
             v.sum_vision_score_advantage_lane_opponent, v.sum_laning_phase_gold_exp_advantage,
             v.sum_early_laning_phase_gold_exp_advantage,
             0::bigint AS sum_physique_damage_done_to_champion_u15,
             0::bigint AS sum_magic_damage_done_to_champion_u15,
             0::bigint AS sum_true_damage_done_to_champion_u15,
             0::int AS sum_kill_u15, 0::int AS sum_assist_u15, 0::int AS sum_death_u15,
             0::int AS sum_vision_score_u15, 0::bigint AS sum_shield_and_heal_u15, 0::int AS sum_minions_killed_u15,
             v.updated_at
      FROM (${unionVs}) v
      INNER JOIN (${unionCore}) c ON c.id = v.champion_stat_id`

    await insertMappedBatches(
      src,
      dst,
      'champion_vs_stats',
      `SELECT COUNT(*)::text AS n FROM (${unionVs}) v INNER JOIN (${unionCore}) c ON c.id = v.champion_stat_id`,
      (lim, off) => `${vsInner} ORDER BY patch, role, rank_tier, region, champion_id, opponent_champion_id LIMIT ${lim} OFFSET ${off}`,
      `INSERT INTO champion_vs_stats (
         patch, role, rank_tier, region, champion_id, opponent_champion_id,
         count_win, count_game, sum_gold_earned, sum_gold_spent, sum_max_level_lead_lane_opponent, sum_max_kill_deficit,
         sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent,
         sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage,
         sum_physique_damage_done_to_champion_u15, sum_magic_damage_done_to_champion_u15, sum_true_damage_done_to_champion_u15,
         sum_kill_u15, sum_assist_u15, sum_death_u15, sum_vision_score_u15, sum_shield_and_heal_u15, sum_minions_killed_u15,
         updated_at
       )`,
      `ON CONFLICT (patch, role, rank_tier, region, champion_id, opponent_champion_id) DO UPDATE SET
         count_win = EXCLUDED.count_win, count_game = EXCLUDED.count_game, updated_at = EXCLUDED.updated_at`,
      26,
      (r) => [
        r.patch,
        r.role,
        r.rank_tier,
        r.region,
        r.champion_id,
        r.opponent_champion_id,
        r.count_win,
        r.count_game,
        r.sum_gold_earned,
        r.sum_gold_spent,
        r.sum_max_level_lead_lane_opponent,
        r.sum_max_kill_deficit,
        r.sum_more_enemy_jungle_than_opponent,
        r.sum_max_cs_advantage_on_lane_opponent,
        r.sum_vision_score_advantage_lane_opponent,
        r.sum_laning_phase_gold_exp_advantage,
        r.sum_early_laning_phase_gold_exp_advantage,
        r.sum_physique_damage_done_to_champion_u15,
        r.sum_magic_damage_done_to_champion_u15,
        r.sum_true_damage_done_to_champion_u15,
        r.sum_kill_u15,
        r.sum_assist_u15,
        r.sum_death_u15,
        r.sum_vision_score_u15,
        r.sum_shield_and_heal_u15,
        r.sum_minions_killed_u15,
        r.updated_at,
      ],
    )
    }

    if (shouldCopy('champion_spell_stats')) {
    const spellInner = `
      SELECT c.game_version AS patch, c.role, c.rank_tier, c.region, c.champion_id,
             COALESCE(NULLIF(btrim(s.spell_order::text), ''), '[]') AS spell_order,
             s.spell1_casts, s.spell2_casts, s.spell3_casts, s.spell4_casts,
             0::bigint AS sum_timestamp_ms,
             s.count_game, s.count_win, s.updated_at
      FROM (${unionSpell}) s
      INNER JOIN (${unionCore}) c ON c.id = s.champion_stat_id`

    await insertMappedBatches(
      src,
      dst,
      'champion_spell_stats',
      `SELECT COUNT(*)::text AS n FROM (${unionSpell}) s INNER JOIN (${unionCore}) c ON c.id = s.champion_stat_id`,
      (lim, off) =>
        `${spellInner} ORDER BY patch, role, rank_tier, region, champion_id, spell_order LIMIT ${lim} OFFSET ${off}`,
      `INSERT INTO champion_spell_stats (
         patch, role, rank_tier, region, champion_id, spell_order,
         spell1_casts, spell2_casts, spell3_casts, spell4_casts, sum_timestamp_ms, count_game, count_win, updated_at
       )`,
      `ON CONFLICT (patch, role, rank_tier, region, champion_id, spell_order) DO UPDATE SET
         spell1_casts = EXCLUDED.spell1_casts, spell2_casts = EXCLUDED.spell2_casts,
         spell3_casts = EXCLUDED.spell3_casts, spell4_casts = EXCLUDED.spell4_casts,
         sum_timestamp_ms = EXCLUDED.sum_timestamp_ms,
         count_game = EXCLUDED.count_game, count_win = EXCLUDED.count_win, updated_at = EXCLUDED.updated_at`,
      14,
      (r) => [
        r.patch,
        r.role,
        r.rank_tier,
        r.region,
        r.champion_id,
        r.spell_order,
        r.spell1_casts,
        r.spell2_casts,
        r.spell3_casts,
        r.spell4_casts,
        r.sum_timestamp_ms,
        r.count_game,
        r.count_win,
        r.updated_at,
      ],
    )
    }

    if (shouldCopy('champion_duo_role_stats')) {
    const duoInner = `
      SELECT c.game_version AS patch, c.role, c.rank_tier, c.region, c.champion_id,
             d.ally_champion_id, d.ally_role,
             d.count_win, d.count_game,
             0::bigint AS sum_gold_earned, 0::bigint AS sum_gold_spent,
             0::int AS sum_max_level_lead_lane_opponent, 0::int AS sum_max_kill_deficit,
             0::int AS sum_more_enemy_jungle_than_opponent, 0::int AS sum_max_cs_advantage_on_lane_opponent,
             0::int AS sum_vision_score_advantage_lane_opponent, 0::int AS sum_laning_phase_gold_exp_advantage,
             0::int AS sum_early_laning_phase_gold_exp_advantage,
             d.updated_at
      FROM (${unionDuo}) d
      INNER JOIN (${unionCore}) c ON c.id = d.champion_stat_id`

    await insertMappedBatches(
      src,
      dst,
      'champion_duo_role_stats',
      `SELECT COUNT(*)::text AS n FROM (${unionDuo}) d INNER JOIN (${unionCore}) c ON c.id = d.champion_stat_id`,
      (lim, off) =>
        `${duoInner} ORDER BY patch, role, rank_tier, region, champion_id, ally_champion_id, ally_role LIMIT ${lim} OFFSET ${off}`,
      `INSERT INTO champion_duo_role_stats (
         patch, role, rank_tier, region, champion_id, ally_champion_id, ally_role,
         count_win, count_game,
         sum_gold_earned, sum_gold_spent, sum_max_level_lead_lane_opponent, sum_max_kill_deficit,
         sum_more_enemy_jungle_than_opponent, sum_max_cs_advantage_on_lane_opponent,
         sum_vision_score_advantage_lane_opponent, sum_laning_phase_gold_exp_advantage,
         sum_early_laning_phase_gold_exp_advantage, updated_at
       )`,
      `ON CONFLICT (patch, role, rank_tier, region, champion_id, ally_champion_id, ally_role) DO UPDATE SET
         count_win = EXCLUDED.count_win, count_game = EXCLUDED.count_game, updated_at = EXCLUDED.updated_at`,
      18,
      (r) => [
        r.patch,
        r.role,
        r.rank_tier,
        r.region,
        r.champion_id,
        r.ally_champion_id,
        r.ally_role,
        r.count_win,
        r.count_game,
        r.sum_gold_earned,
        r.sum_gold_spent,
        r.sum_max_level_lead_lane_opponent,
        r.sum_max_kill_deficit,
        r.sum_more_enemy_jungle_than_opponent,
        r.sum_max_cs_advantage_on_lane_opponent,
        r.sum_vision_score_advantage_lane_opponent,
        r.sum_laning_phase_gold_exp_advantage,
        r.sum_early_laning_phase_gold_exp_advantage,
        r.updated_at,
      ],
    )
    }

    if (shouldCopy('team_core_stat')) {
    const teamInner = `
      SELECT t.game_version AS patch, t.rank_tier, '${REGION_GLOBAL}'::text AS region, t.team::smallint,
             t.count_win, t.count_game, t.count_team_early_surrendered, t.count_team_surrendered, t.updated_at
      FROM (${unionTeam}) t`

    await insertMappedBatches(
      src,
      dst,
      'team_core_stat',
      `SELECT COUNT(*)::text AS n FROM (${unionTeam}) t`,
      (lim, off) => `${teamInner} ORDER BY patch, rank_tier, region, team LIMIT ${lim} OFFSET ${off}`,
      `INSERT INTO team_core_stat (
         patch, rank_tier, region, team, count_win, count_game, count_team_early_surrendered, count_team_surrendered, updated_at
       )`,
      `ON CONFLICT (patch, rank_tier, region, team) DO UPDATE SET
         count_win = EXCLUDED.count_win, count_game = EXCLUDED.count_game,
         count_team_early_surrendered = EXCLUDED.count_team_early_surrendered,
         count_team_surrendered = EXCLUDED.count_team_surrendered, updated_at = EXCLUDED.updated_at`,
      9,
      (r) => [
        r.patch,
        r.rank_tier,
        r.region,
        r.team,
        r.count_win,
        r.count_game,
        r.count_team_early_surrendered,
        r.count_team_surrendered,
        r.updated_at,
      ],
    )
    }

    if (shouldCopy('champion_bans_by_banner') && (await tableExists(src, 'agg_champion_bans_by_banner'))) {
      const unionBans = hasArchBans
        ? `SELECT * FROM agg_champion_bans_by_banner UNION ALL SELECT * FROM archive_agg_champion_bans_by_banner`
        : `SELECT * FROM agg_champion_bans_by_banner`
      const bansAgg = `
        SELECT x.game_version AS patch, x.rank_tier, '${REGION_GLOBAL}'::text AS region, x.banned_champion_id::smallint,
               COALESCE(SUM(CASE WHEN x.team_num = 100 THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_team_100,
               COALESCE(SUM(CASE WHEN x.team_num = 200 THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_team_200,
               COALESCE(SUM(CASE WHEN UPPER(TRIM(x.banner_role_norm)) = 'TOP' THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_top,
               COALESCE(SUM(CASE WHEN UPPER(TRIM(x.banner_role_norm)) IN ('JUNGLE', 'JUNGLER') THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_jungle,
               COALESCE(SUM(CASE WHEN UPPER(TRIM(x.banner_role_norm)) IN ('MID', 'MIDDLE') THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_mid,
               COALESCE(SUM(CASE WHEN UPPER(TRIM(x.banner_role_norm)) IN ('ADC', 'BOTTOM') THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_adc,
               COALESCE(SUM(CASE WHEN UPPER(TRIM(x.banner_role_norm)) = 'SUPPORT' THEN x.ban_count ELSE 0 END), 0)::int AS count_banner_support
        FROM (${unionBans}) x
        WHERE UPPER(TRIM(COALESCE(x.rank_tier, ''))) <> 'UNRANKED'
        GROUP BY x.game_version, x.rank_tier, x.banned_champion_id`
      await insertMappedBatches(
        src,
        dst,
        'champion_bans_by_banner',
        `SELECT COUNT(*)::text AS n FROM (${bansAgg}) b`,
        (lim, off) =>
          `SELECT * FROM (${bansAgg}) q ORDER BY patch, rank_tier, region, banned_champion_id LIMIT ${lim} OFFSET ${off}`,
        `INSERT INTO champion_bans_by_banner (
           patch, rank_tier, region, banned_champion_id,
           count_banner_team_100, count_banner_team_200,
           count_banner_top, count_banner_jungle, count_banner_mid, count_banner_adc, count_banner_support
         )`,
        `ON CONFLICT (patch, rank_tier, region, banned_champion_id) DO UPDATE SET
           count_banner_team_100 = EXCLUDED.count_banner_team_100,
           count_banner_team_200 = EXCLUDED.count_banner_team_200,
           count_banner_top = EXCLUDED.count_banner_top,
           count_banner_jungle = EXCLUDED.count_banner_jungle,
           count_banner_mid = EXCLUDED.count_banner_mid,
           count_banner_adc = EXCLUDED.count_banner_adc,
           count_banner_support = EXCLUDED.count_banner_support`,
        11,
        (r) => [
          r.patch,
          r.rank_tier,
          r.region,
          r.banned_champion_id,
          r.count_banner_team_100,
          r.count_banner_team_200,
          r.count_banner_top,
          r.count_banner_jungle,
          r.count_banner_mid,
          r.count_banner_adc,
          r.count_banner_support,
        ],
      )
    }

    if (
      shouldCopy('objective_outcome_histogram') &&
      (await tableExists(src, 'agg_team_bucket')) &&
      (await tableExists(src, 'agg_team_core_stats'))
    ) {
      await copyObjectiveOutcomeHistogram(src, dst, hasArchTeam, hasArchTb)
    }

    if (shouldCopy('champion_tier_daily_snapshots') && (await tableExists(src, 'champion_tier_daily_snapshots'))) {
      const snapInner = `
        SELECT '${PATCH_SNAPSHOT}'::text AS patch, s.role, s.rank_tier, '${REGION_GLOBAL}'::text AS region,
               s.champion_id, s.date_of_game, s.games, s.wins, 0::int AS count_ban
        FROM champion_tier_daily_snapshots s`

      await insertMappedBatches(
        src,
        dst,
        'champion_tier_daily_snapshots',
        `SELECT COUNT(*)::text AS n FROM champion_tier_daily_snapshots`,
        (lim, off) =>
          `${snapInner} ORDER BY patch, role, rank_tier, region, champion_id, date_of_game LIMIT ${lim} OFFSET ${off}`,
        `INSERT INTO champion_tier_daily_snapshots (
           patch, role, rank_tier, region, champion_id, date_of_game, games, wins, count_ban
         )`,
        `ON CONFLICT (patch, role, rank_tier, region, champion_id, date_of_game) DO UPDATE SET
           games = EXCLUDED.games, wins = EXCLUDED.wins, count_ban = EXCLUDED.count_ban`,
        9,
        (r) => [
          r.patch,
          r.role,
          r.rank_tier,
          r.region,
          r.champion_id,
          r.date_of_game,
          r.games,
          r.wins,
          r.count_ban,
        ],
      )
    }

    if (shouldCopy('champion_stats')) {
    const coreStatsInner = `
      SELECT c.game_version AS patch, c.role, c.rank_tier, c.region, ${TEAM_STATS}::smallint AS team,
             c.count_win, c.count_game,
             c.sum_gold_earned, c.sum_gold_spent, 0::bigint AS sum_bounty_gold,
             c.sum_max_level_lead_lane_opponent, c.sum_max_kill_deficit, c.sum_more_enemy_jungle_than_opponent,
             c.sum_max_cs_advantage_on_lane_opponent, c.sum_vision_score_advantage_lane_opponent,
             c.sum_laning_phase_gold_exp_advantage, c.sum_early_laning_phase_gold_exp_advantage,
             c.updated_at
      FROM (${unionCore}) c`

    await insertMappedBatches(
      src,
      dst,
      'champion_stats (core subset)',
      `SELECT COUNT(*)::text AS n FROM (${unionCore}) c`,
      (lim, off) =>
        `${coreStatsInner} ORDER BY patch, role, rank_tier, region, champion_id, team LIMIT ${lim} OFFSET ${off}`,
      `INSERT INTO champion_stats (
         patch, role, rank_tier, region, champion_id, team,
         count_win, count_game,
         sum_gold_earned, sum_gold_spent, sum_bounty_gold,
         sum_max_level_lead_lane_opponent, sum_max_kill_deficit, sum_more_enemy_jungle_than_opponent,
         sum_max_cs_advantage_on_lane_opponent, sum_vision_score_advantage_lane_opponent,
         sum_laning_phase_gold_exp_advantage, sum_early_laning_phase_gold_exp_advantage, updated_at
       )`,
      `ON CONFLICT (patch, role, rank_tier, region, champion_id, team) DO UPDATE SET
         count_win = EXCLUDED.count_win, count_game = EXCLUDED.count_game,
         sum_gold_earned = EXCLUDED.sum_gold_earned, sum_gold_spent = EXCLUDED.sum_gold_spent,
         updated_at = EXCLUDED.updated_at`,
      18,
      (r) => [
        r.patch,
        r.role,
        r.rank_tier,
        r.region,
        r.team,
        r.count_win,
        r.count_game,
        r.sum_gold_earned,
        r.sum_gold_spent,
        r.sum_bounty_gold,
        r.sum_max_level_lead_lane_opponent,
        r.sum_max_kill_deficit,
        r.sum_more_enemy_jungle_than_opponent,
        r.sum_max_cs_advantage_on_lane_opponent,
        r.sum_vision_score_advantage_lane_opponent,
        r.sum_laning_phase_gold_exp_advantage,
        r.sum_early_laning_phase_gold_exp_advantage,
        r.updated_at,
      ],
    )
    }

    if (shouldCopy('match_outcome_stats') && unionMo) {
      const moInner = `
        SELECT m.game_version AS patch, m.rank_tier, '${REGION_GLOBAL}'::text AS region,
               m.count_match, m.updated_at
        FROM (${unionMo}) m`

      await insertMappedBatches(
        src,
        dst,
        'match_outcome_stats',
        `SELECT COUNT(*)::text AS n FROM (${unionMo}) m`,
        (lim, off) => `${moInner} ORDER BY patch, rank_tier, region LIMIT ${lim} OFFSET ${off}`,
        `INSERT INTO match_outcome_stats (patch, rank_tier, region, count_match, updated_at)`,
        `ON CONFLICT (patch, rank_tier) DO UPDATE SET count_match = EXCLUDED.count_match, updated_at = EXCLUDED.updated_at`,
        5,
        (r) => [r.patch, r.rank_tier, r.region, r.count_match, r.updated_at],
      )
    }

    if (shouldCopy('processed_matches') && (await tableExists(src, 'tracked_matches'))) {
      const pmInner = `
        SELECT COALESCE(im.game_version, 'unknown'::text) AS patch,
               tm.match_id AS riot_match_id,
               COALESCE(im.game_date::date, tm.created_at::date) AS game_date,
               tm.status, tm.aggregate_status, tm.aggregate_attempt_count, tm.aggregate_last_error,
               tm.aggregated_at, tm.created_at
        FROM tracked_matches tm
        LEFT JOIN ingest_matchs im ON im.riot_match_id = tm.match_id`

      await insertMappedBatches(
        src,
        dst,
        'processed_matches',
        `SELECT COUNT(*)::text AS n FROM tracked_matches tm LEFT JOIN ingest_matchs im ON im.riot_match_id = tm.match_id`,
        (lim, off) => `${pmInner} ORDER BY patch, riot_match_id LIMIT ${lim} OFFSET ${off}`,
        `INSERT INTO processed_matches (
           patch, riot_match_id, game_date, status, aggregate_status, aggregate_attempt_count,
           aggregate_last_error, aggregated_at, created_at
         )`,
        `ON CONFLICT (patch, riot_match_id) DO UPDATE SET
           game_date = EXCLUDED.game_date, status = EXCLUDED.status, aggregate_status = EXCLUDED.aggregate_status,
           aggregate_attempt_count = EXCLUDED.aggregate_attempt_count, aggregate_last_error = EXCLUDED.aggregate_last_error,
           aggregated_at = EXCLUDED.aggregated_at, created_at = EXCLUDED.created_at`,
        9,
        (r) => [
          r.patch,
          r.riot_match_id,
          r.game_date,
          r.status,
          r.aggregate_status,
          r.aggregate_attempt_count,
          r.aggregate_last_error,
          r.aggregated_at,
          r.created_at,
        ],
      )
    }

    console.log('[copyStatsToStatistiquesDb] done')
  } finally {
    await src.end()
    await dst.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
