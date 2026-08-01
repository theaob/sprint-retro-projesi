import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, 'tmp');

// Ensures every test run starts from a clean, throwaway SQLite database —
// never the real data/retro.db.
export default function setup() {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
}
