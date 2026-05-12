type Environment = "dev" | "prod";

type Config = {
  REDIS_URL: string;
  DATABASE_URL: string;
  RIOT_API_KEY: string;
  ENV: Environment;
  RATE_LIMIT_PER_1S: number;
  RATE_LIMIT_PER_120S: number;
  HYDRATION_CONCURRENCY: number;
  BATCH_SIZE: number;
};

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

export const config: Config = {
  REDIS_URL: getRequiredEnv("REDIS_URL"),
  DATABASE_URL: getRequiredEnv("DATABASE_URL"),
  RIOT_API_KEY: getRequiredEnv("RIOT_API_KEY"),
  ENV,
  ...configByEnv[ENV],
  BATCH_SIZE: 500,
};
