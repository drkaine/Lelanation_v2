import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/poller/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
