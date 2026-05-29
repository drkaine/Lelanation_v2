import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env') });

process.env.API_KEY_TYPE ??= 'personal';
process.env.LOG_LEVEL = 'error';
