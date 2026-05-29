import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/poller/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
