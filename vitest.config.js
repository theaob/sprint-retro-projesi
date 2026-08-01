import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './test/global-setup.js',
    env: {
      DB_PATH: './test/tmp/test.db'
    },
    // Route tests share one SQLite file for the whole run — keep them sequential
    // so parallel workers can't race on writes to the same database.
    fileParallelism: false
  }
});
