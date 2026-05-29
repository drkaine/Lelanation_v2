import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/riot-gateway/integration/**/*.test.ts'],
    exclude: ['tests/riot-gateway/integration/liveSoak.test.ts'],
    setupFiles: ['tests/riot-gateway/integration/setup.ts'],
    environment: 'node',
    testTimeout: 1_800_000,
    hookTimeout: 30_000,
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
