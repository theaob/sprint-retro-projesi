import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'retro.db');

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
`);

// Seed default admin if none exists
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), 'admin', hash, 'admin');
  console.log('✅ Default admin created: admin / admin');
}

// Migration: add max_votes safely
try {
  const tableInfo = db.pragma('table_info(retros)');
  const hasMaxVotes = tableInfo.some((col) => col.name === 'max_votes');
  if (!hasMaxVotes) {
    db.exec('ALTER TABLE retros ADD COLUMN max_votes INTEGER DEFAULT 3;');
    console.log('✅ Migration applied: added max_votes to retros table.');
  }
} catch (err) {
  console.error('Migration error:', err);
}

export default db;
