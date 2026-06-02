import type { ApiKeyType, LogLevel } from '../types.js';

function envStr(key: string, fallback = ''): string {
  const value = process.env[key];
  return value !== undefined && value !== '' ? value.trim() : fallback;
}

function envInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(envStr(key, String(fallback)), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFloat(key: string, fallback: number): number {
  const parsed = Number.parseFloat(envStr(key, String(fallback)));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const riotConfig = {
  get apiKey(): string {
    return envStr('RIOT_API_KEY');
  },
  get apiKeyType(): ApiKeyType {
    return envStr('API_KEY_TYPE', 'personal') as ApiKeyType;
  },
  get regionalUrl(): string {
    return envStr('RIOT_REGION_URL', 'https://europe.api.riotgames.com');
  },
  get platformUrl(): string {
    return envStr('RIOT_PLATFORM_URL', 'https://euw1.api.riotgames.com');
  },
  get testPuuid(): string {
    return envStr('TEST_PUUID');
  },
  get logLevel(): LogLevel {
    return envStr('LOG_LEVEL', 'debug') as LogLevel;
  },
  get maxConcurrency(): number {
    if (this.apiKeyType === 'personal') {
      return envInt('PERSONAL_MAX_CONCURRENCY', 1);
    }
    return envInt('MAX_CONCURRENCY', 10);
  },
  get safetyMargin(): number {
    if (this.apiKeyType === 'personal') {
      return envFloat('PERSONAL_SAFETY_MARGIN', envFloat('SAFETY_MARGIN', 0.02));
    }
    return envFloat('SAFETY_MARGIN', 0.05);
  },
  get maxDispatchesPerFlush(): number {
    if (this.apiKeyType === 'personal') {
      return envInt('PERSONAL_MAX_DISPATCHES_PER_FLUSH', 1);
    }
    return envInt('MAX_DISPATCHES_PER_FLUSH', 50);
  },
  maxRetries: 3,
  get soakDurationMinutes(): number {
    return envInt('SOAK_DURATION_MINUTES', 10);
  },

  fallbackLimits: {
    personal: {
      app: [
        { limit: 99, windowMs: 120_000 },
        { limit: 19, windowMs: 1_000 },
      ],
    },
    production: {
      app: [
        { limit: 29_999, windowMs: 120_000 },
        { limit: 499, windowMs: 1_000 },
      ],
    },
  },
};

export type ConfigValidationResult = {
  valid: boolean;
  fatalReason?: string;
  warnings: string[];
};

export function validateConfig(): ConfigValidationResult {
  const warnings: string[] = [];

  if (!riotConfig.apiKey || !riotConfig.apiKey.startsWith('RGAPI-')) {
    return { valid: false, fatalReason: 'missing RIOT_API_KEY', warnings };
  }

  if (riotConfig.apiKeyType !== 'personal' && riotConfig.apiKeyType !== 'production') {
    return { valid: false, fatalReason: 'invalid API_KEY_TYPE', warnings };
  }

  if (!riotConfig.testPuuid) {
    warnings.push('missing TEST_PUUID');
  }

  return { valid: true, warnings };
}
