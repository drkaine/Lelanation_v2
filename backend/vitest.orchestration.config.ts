import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/poll-orchestration/setup.ts'],
    include: ['tests/poll-orchestration/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
