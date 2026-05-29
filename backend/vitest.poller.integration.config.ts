import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/poller/integration/**/*.test.ts'],
    setupFiles: ['tests/poller/integration/setup.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
