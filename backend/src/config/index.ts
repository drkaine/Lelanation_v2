type Environment = "dev" | "prod";

type Config = {
  REDIS_URL: string;
  DATABASE_URL: string;
  RIOT_API_KEY: string;
  ENV: Environment;
  PLAYER_KEY_VERSION: string;
  RATE_LIMIT_PER_1S: number;
  RATE_LIMIT_PER_120S: number;
  HYDRATION_CONCURRENCY: number;
  BATCH_SIZE: number;
  DISCOVERY_PLAYERS_PER_TICK: number;
  DISCOVERY_MIN_QUEUE_DEPTH: number;
  MAX_HYDRATION_QUEUE_DEPTH: number;
  DISCOVERY_INTERVAL_MS: number;
  /** Pause discovery/hydration tant que rank.waiting dépasse ce seuil. */
  MAX_RANK_BACKLOG_PAUSE_PIPELINES: number;
  /** Débit rank « normal » (hors drain). */
  RANK_LIMITER_MAX_NORMAL: number;
};

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function getRequiredEnv(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseEnvironment(rawEnv: string): Environment {
  if (rawEnv === "dev" || rawEnv === "prod") {
    return rawEnv;
  }
  throw new Error(`Invalid ENV value "${rawEnv}". Expected "dev" or "prod".`);
}

const ENV = parseEnvironment(getRequiredEnv("ENV"));

const configByEnv: Record<
  Environment,
  Pick<Config, "RATE_LIMIT_PER_1S" | "RATE_LIMIT_PER_120S" | "HYDRATION_CONCURRENCY">
> = {
  dev: {
    RATE_LIMIT_PER_1S: 10,
    RATE_LIMIT_PER_120S: 95,
    HYDRATION_CONCURRENCY: 8,
  },
  prod: {
    RATE_LIMIT_PER_1S: 100,
    RATE_LIMIT_PER_120S: 28500,
    HYDRATION_CONCURRENCY: 80,
  },
};

const rateLimitPer1sOverride =
  parsePositiveInt(process.env.RIOT_RATE_LIMIT_PER_1S) ??
  parsePositiveInt(process.env.RIOT_APP_TARGET_PER_1S);
const rateLimitPer120sOverride =
  parsePositiveInt(process.env.RIOT_RATE_LIMIT_PER_120S) ??
  parsePositiveInt(process.env.RIOT_APP_TARGET_PER_120S);

export const config: Config = {
  REDIS_URL: getRequiredEnv("REDIS_URL"),
  DATABASE_URL: getRequiredEnv("DATABASE_URL"),
  RIOT_API_KEY: getRequiredEnv("RIOT_API_KEY"),
  ENV,
  PLAYER_KEY_VERSION: process.env.PLAYER_KEY_VERSION || ENV,
  ...configByEnv[ENV],
  RATE_LIMIT_PER_1S: rateLimitPer1sOverride ?? configByEnv[ENV].RATE_LIMIT_PER_1S,
  RATE_LIMIT_PER_120S: rateLimitPer120sOverride ?? configByEnv[ENV].RATE_LIMIT_PER_120S,
  BATCH_SIZE: 500,
  DISCOVERY_PLAYERS_PER_TICK:
    parsePositiveInt(process.env.DISCOVERY_PLAYERS_PER_TICK) ?? 6,
  DISCOVERY_MIN_QUEUE_DEPTH:
    parsePositiveInt(process.env.DISCOVERY_MIN_QUEUE_DEPTH) ?? 20,
  MAX_HYDRATION_QUEUE_DEPTH:
    parsePositiveInt(process.env.MAX_HYDRATION_QUEUE_DEPTH) ?? 500,
  DISCOVERY_INTERVAL_MS:
    parsePositiveInt(process.env.DISCOVERY_INTERVAL_MS) ?? 45_000,
  MAX_RANK_BACKLOG_PAUSE_PIPELINES:
    parsePositiveInt(process.env.MAX_RANK_BACKLOG_PAUSE_PIPELINES) ?? 5_000,
  RANK_LIMITER_MAX_NORMAL:
    parsePositiveInt(process.env.RANK_LIMITER_MAX_NORMAL) ?? 17,
};
