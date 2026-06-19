import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Priority: DB_PATH env var > data/retro.db in project root
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'retro.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS retros (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    max_votes INTEGER DEFAULT 3,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    retro_id TEXT REFERENCES retros(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS entries (
    id TEXT PRIMARY KEY,
    column_id TEXT REFERENCES columns(id) ON DELETE CASCADE,
    retro_id TEXT REFERENCES retros(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    author TEXT DEFAULT 'Anonim',
    votes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS action_items (
    id TEXT PRIMARY KEY,
    retro_id TEXT REFERENCES retros(id) ON DELETE CASCADE,
    entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    assignee TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default admin if none exists
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), 'admin', hash, 'admin');
  console.log('✅ Default admin created: admin / admin');
}

// Migration: add columns safely
try {
  const tableInfo = db.pragma('table_info(retros)');
  
  if (!tableInfo.some((col) => col.name === 'max_votes')) {
    db.exec('ALTER TABLE retros ADD COLUMN max_votes INTEGER DEFAULT 3;');
    console.log('✅ Migration applied: added max_votes to retros table.');
  }

  if (!tableInfo.some((col) => col.name === 'created_by')) {
    db.exec('ALTER TABLE retros ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;');
    console.log('✅ Migration applied: added created_by to retros table.');
  }

  if (!tableInfo.some((col) => col.name === 'status')) {
    db.exec("ALTER TABLE retros ADD COLUMN status TEXT DEFAULT 'active';");
    console.log('✅ Migration applied: added status to retros table.');
  }
} catch (err) {
  console.error('Migration error (retros):', err);
}

// Migration: add email to users
try {
  const usersInfo = db.pragma('table_info(users)');
  if (!usersInfo.some((col) => col.name === 'email')) {
    db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
    console.log('✅ Migration applied: added email to users table.');
  }
} catch (err) {
  console.error('Migration error (users):', err);
}

// Migration: add short_code to retros
try {
  const tableInfo = db.pragma('table_info(retros)');
  if (!tableInfo.some((col) => col.name === 'short_code')) {
    db.exec('ALTER TABLE retros ADD COLUMN short_code TEXT UNIQUE;');
    console.log('✅ Migration applied: added short_code to retros table.');

    // Backfill existing retros
    const retros = db.prepare('SELECT id FROM retros WHERE short_code IS NULL').all();
    if (retros.length > 0) {
      const updateStmt = db.prepare('UPDATE retros SET short_code = ? WHERE id = ?');
      db.transaction(() => {
        for (const retro of retros) {
          let code;
          let exists = true;
          while (exists) {
            code = Math.random().toString(36).substring(2, 8);
            const row = db.prepare('SELECT id FROM retros WHERE short_code = ?').get(code);
            if (!row) exists = false;
          }
          updateStmt.run(code, retro.id);
        }
      })();
      console.log(`✅ Backfilled short_code for ${retros.length} existing retros.`);
    }
  }
} catch (err) {
  console.error('Migration error (short_code):', err);
}

export default db;
