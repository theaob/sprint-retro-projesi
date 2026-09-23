import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbModule = path.join(__dirname, '..', 'server', 'db.js');

// Boots server/db.js in a fresh process against its own database file and
// returns what it logged plus the resulting schema version.
function boot(dbPath) {
  const script = `import(${JSON.stringify(dbModule)}).then(({ default: db }) => {
    console.log('VERSION=' + db.pragma('user_version', { simple: true }));
  });`;
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, DB_PATH: dbPath },
    encoding: 'utf8'
  });
}

describe('schema migrations', () => {
  it('run once on a fresh database and not again on the next boot', () => {
    const dbPath = path.join(__dirname, 'tmp', 'migrations-once.db');

    const first = boot(dbPath);
    expect(first).toContain('Migration applied');
    const version = first.match(/VERSION=(\d+)/)[1];
    expect(Number(version)).toBeGreaterThanOrEqual(2);

    const second = boot(dbPath);
    expect(second).not.toContain('Migration applied');
    expect(second).toContain(`VERSION=${version}`);
  });
});
