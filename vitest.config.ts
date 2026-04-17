import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially — sims are shared mutable state
    fileParallelism: false,
    /** When VITEST_MANAGE_SIMS=1 (see package.json test scripts), start or reuse sims */
    globalSetup: ['./tests/global-setup.ts'],
  },
});
