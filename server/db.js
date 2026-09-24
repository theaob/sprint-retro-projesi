import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';

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

// ── Schema versioning ───────────────────────────────────────
// Migrations run in numbered steps tracked by SQLite's own `user_version`
// pragma, so each step runs exactly once per database instead of on every
// boot. Step 1 is the whole pre-versioning history — the original schema
// plus every migration block written before versioning existed, kept
// verbatim below. Several of those blocks re-created and then dropped the
// same tables (teams, action_items), so un-gated they rewrote tables on
// every start. A database that predates versioning reads user_version 0
// and replays step 1 once (every block in it is safe to re-run), then
// never again.
//
// To change the schema: append a new `if (schemaVersion < N)` step at the
// end with the next number and bump the version inside it. Never edit or
// remove an existing step.
const schemaVersion = db.pragma('user_version', { simple: true });

if (schemaVersion < 1) {
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
      must_change_password INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      retro_id TEXT REFERENCES retros(id) ON DELETE CASCADE,
      entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      assignee TEXT,
      done INTEGER DEFAULT 0,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      retro_id TEXT REFERENCES retros(id) ON DELETE CASCADE,
      entry_id TEXT REFERENCES entries(id) ON DELETE CASCADE,
      participant_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique ON votes(retro_id, entry_id, participant_id);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      columns TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

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
      db.exec('ALTER TABLE retros ADD COLUMN short_code TEXT;');
      console.log('✅ Migration applied: added short_code column to retros table.');
    }

    // Backfill existing retros with unique codes
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

    // Enforce uniqueness with a unique index
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_retros_short_code ON retros(short_code);');
  } catch (err) {
    console.error('Migration error (short_code):', err);
  }

  // Migration: add must_change_password to users, and retroactively flag any
  // admin account still sitting on the literal seeded 'admin' password —
  // not just freshly-created ones.
  try {
    const usersInfo = db.pragma('table_info(users)');
    if (!usersInfo.some((col) => col.name === 'must_change_password')) {
      db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;');
      console.log('✅ Migration applied: added must_change_password to users table.');
    }

    const admins = db.prepare("SELECT id, password_hash FROM users WHERE role = 'admin'").all();
    const flagStmt = db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?');
    let flagged = 0;
    for (const admin of admins) {
      if (bcrypt.compareSync('admin', admin.password_hash)) {
        flagStmt.run(admin.id);
        flagged++;
      }
    }
    if (flagged > 0) {
      console.log(`✅ Flagged ${flagged} admin account(s) still on the default password for a forced change.`);
    }
  } catch (err) {
    console.error('Migration error (must_change_password):', err);
  }

  // Migration: add expires_at to sessions, backfilling existing (previously
  // eternal) sessions to a 30-day grace window instead of leaving them
  // unexpiring forever or invalidating everyone immediately.
  try {
    const sessionsInfo = db.pragma('table_info(sessions)');
    if (!sessionsInfo.some((col) => col.name === 'expires_at')) {
      db.exec('ALTER TABLE sessions ADD COLUMN expires_at TEXT;');
      console.log('✅ Migration applied: added expires_at to sessions table.');
    }

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const backfilled = db.prepare('UPDATE sessions SET expires_at = ? WHERE expires_at IS NULL')
      .run(thirtyDaysFromNow);
    if (backfilled.changes > 0) {
      console.log(`✅ Backfilled expires_at for ${backfilled.changes} existing session(s).`);
    }
  } catch (err) {
    console.error('Migration error (expires_at):', err);
  }

  // Migration: add done / due_date to action_items
  try {
    const actionItemsInfo = db.pragma('table_info(action_items)');
    if (!actionItemsInfo.some((col) => col.name === 'done')) {
      db.exec('ALTER TABLE action_items ADD COLUMN done INTEGER DEFAULT 0;');
      console.log('✅ Migration applied: added done to action_items table.');
    }
    if (!actionItemsInfo.some((col) => col.name === 'due_date')) {
      db.exec('ALTER TABLE action_items ADD COLUMN due_date TEXT;');
      console.log('✅ Migration applied: added due_date to action_items table.');
    }
  } catch (err) {
    console.error('Migration error (action_items done/due_date):', err);
  }

  // Migration: promote the free-text users.team to a first-class `teams`
  // table, referenced from users/retros/templates. Free text invited
  // duplicates ("Takım A" vs "takım a"), and inferring a retro's team from
  // its creator (the previous approach) misattributes retros whenever a
  // Scrum Master covers for another team. Backfills teams from whatever
  // distinct team strings already exist, then drops the old column —
  // users.team was only introduced earlier this same release, so there's
  // no real deployment depending on it yet.
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const usersInfo = db.pragma('table_info(users)');
    const retrosInfo = db.pragma('table_info(retros)');
    const templatesInfo = db.pragma('table_info(templates)');

    if (!usersInfo.some((col) => col.name === 'team_id')) {
      db.exec('ALTER TABLE users ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE SET NULL;');
      console.log('✅ Migration applied: added team_id to users table.');
    }
    if (!retrosInfo.some((col) => col.name === 'team_id')) {
      db.exec('ALTER TABLE retros ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE SET NULL;');
      console.log('✅ Migration applied: added team_id to retros table.');
    }
    if (!templatesInfo.some((col) => col.name === 'team_id')) {
      db.exec('ALTER TABLE templates ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE SET NULL;');
      console.log('✅ Migration applied: added team_id to templates table.');
    }

    // Backfill: still has the old `team` string column to read from?
    if (usersInfo.some((col) => col.name === 'team')) {
      const distinctTeamNames = db.prepare("SELECT DISTINCT team FROM users WHERE team IS NOT NULL AND team != ''").all();
      const insertTeam = db.prepare('INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?)');
      const assignUserTeam = db.prepare(`
        UPDATE users SET team_id = (SELECT id FROM teams WHERE name = ?) WHERE team = ? AND team_id IS NULL
      `);
      db.transaction(() => {
        for (const row of distinctTeamNames) {
          insertTeam.run(randomUUID(), row.team);
          assignUserTeam.run(row.team, row.team);
        }
      })();
      if (distinctTeamNames.length > 0) {
        console.log(`✅ Backfilled ${distinctTeamNames.length} team(s) from the old users.team column.`);
      }

      db.exec('ALTER TABLE users DROP COLUMN team;');
      console.log('✅ Migration applied: dropped the old users.team text column.');
    }
  } catch (err) {
    console.error('Migration error (teams):', err);
  }

  // Migration: demote the `teams` table back to a free-text `team` column on
  // users/retros/templates. A managed team entity with its own CRUD screen
  // turned out to be more machinery than the feature needed — team is just a
  // label. Keeps the one real fix from the teams-table era (a retro's team is
  // still set explicitly at creation, not inferred from its creator) while
  // dropping the separately-managed list.
  try {
    const teamsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'teams'").get();
    if (teamsTableExists) {
      const usersInfo = db.pragma('table_info(users)');
      const retrosInfo = db.pragma('table_info(retros)');
      const templatesInfo = db.pragma('table_info(templates)');

      if (!usersInfo.some((col) => col.name === 'team')) {
        db.exec('ALTER TABLE users ADD COLUMN team TEXT;');
        console.log('✅ Migration applied: added team back to users table.');
      }
      if (!retrosInfo.some((col) => col.name === 'team')) {
        db.exec('ALTER TABLE retros ADD COLUMN team TEXT;');
        console.log('✅ Migration applied: added team back to retros table.');
      }
      if (!templatesInfo.some((col) => col.name === 'team')) {
        db.exec('ALTER TABLE templates ADD COLUMN team TEXT;');
        console.log('✅ Migration applied: added team back to templates table.');
      }

      db.exec(`UPDATE users SET team = (SELECT name FROM teams WHERE teams.id = users.team_id) WHERE team_id IS NOT NULL;`);
      db.exec(`UPDATE retros SET team = (SELECT name FROM teams WHERE teams.id = retros.team_id) WHERE team_id IS NOT NULL;`);
      db.exec(`UPDATE templates SET team = (SELECT name FROM teams WHERE teams.id = templates.team_id) WHERE team_id IS NOT NULL;`);

      db.exec('ALTER TABLE users DROP COLUMN team_id;');
      db.exec('ALTER TABLE retros DROP COLUMN team_id;');
      db.exec('ALTER TABLE templates DROP COLUMN team_id;');
      db.exec('DROP TABLE teams;');
      console.log('✅ Migration applied: dropped the teams table and team_id columns, backfilled free-text team.');
    }
  } catch (err) {
    console.error('Migration error (demote teams):', err);
  }

  // Migration: drop the team field entirely. Even as a free-text label it
  // wasn't earning its keep — removed from users/retros/templates and from
  // the Open Actions filter (back to one flat list per account).
  try {
    const usersInfo = db.pragma('table_info(users)');
    const retrosInfo = db.pragma('table_info(retros)');
    const templatesInfo = db.pragma('table_info(templates)');

    if (usersInfo.some((col) => col.name === 'team')) {
      db.exec('ALTER TABLE users DROP COLUMN team;');
      console.log('✅ Migration applied: dropped team from users table.');
    }
    if (retrosInfo.some((col) => col.name === 'team')) {
      db.exec('ALTER TABLE retros DROP COLUMN team;');
      console.log('✅ Migration applied: dropped team from retros table.');
    }
    if (templatesInfo.some((col) => col.name === 'team')) {
      db.exec('ALTER TABLE templates DROP COLUMN team;');
      console.log('✅ Migration applied: dropped team from templates table.');
    }
  } catch (err) {
    console.error('Migration error (drop team):', err);
  }

  // Migration: drop action-item tracking entirely — no more turning entries
  // into action items, no assignee/due-date/done tracking, no cross-retro
  // Open Actions rollup.
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'action_items'").get();
    if (tableExists) {
      db.exec('DROP TABLE action_items;');
      console.log('✅ Migration applied: dropped the action_items table.');
    }
  } catch (err) {
    console.error('Migration error (drop action_items):', err);
  }

  db.pragma('user_version = 1');
}

// Seed default admin if none exists
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)')
    .run(randomUUID(), 'admin', hash, 'admin');
  console.log('✅ Default admin created: admin / admin (must change password on first login)');
}

// Seed the built-in retro templates if the table is empty — preserves the
// exact same defaults that used to be a hardcoded array in admin.js, now
// just editable by admins instead of requiring a code change.
const templateCount = db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
if (templateCount === 0) {
  const defaultTemplates = [
    { name: 'Standard', cols: ['Went well', 'To improve', 'Action items'] },
    { name: 'GBI', cols: ['Good', 'Bad', 'Improvement'] },
    { name: 'Mad/Sad/Glad', cols: ['Mad 😠', 'Sad 😢', 'Glad 😃', 'Actions 🚀'] },
    { name: 'Start/Stop/Continue', cols: ['Start 🟢', 'Stop 🔴', 'Continue 🟡'] },
    { name: '4Ls', cols: ['Liked 👍', 'Learned 🧠', 'Lacked 👎', 'Longed For 🥺'] }
  ];
  const insertTemplate = db.prepare('INSERT INTO templates (id, name, columns, sort_order) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    defaultTemplates.forEach((t, idx) => { insertTemplate.run(randomUUID(), t.name, JSON.stringify(t.cols), idx); });
  })();
  console.log(`✅ Seeded ${defaultTemplates.length} default retro templates.`);
}

// Step 2
if (schemaVersion < 2) {
  // Migration: move guest votes into their own `anon:` participant namespace.
  // Guest and user votes used to share one id space, so a guest could submit a
  // real user's id as their participant_id and act on that user's votes. Any
  // participant_id that isn't a user id (and isn't already prefixed) is a
  // guest's — prefix it so existing guests keep their votes.
  try {
    const moved = db.prepare(`
      UPDATE votes SET participant_id = 'anon:' || participant_id
      WHERE participant_id NOT LIKE 'anon:%'
        AND participant_id NOT IN (SELECT id FROM users)
    `).run();
    if (moved.changes > 0) {
      console.log(`✅ Migration applied: moved ${moved.changes} guest vote(s) into the anon: namespace.`);
    }
  } catch (err) {
    console.error('Migration error (anon vote namespace):', err);
  }

  db.pragma('user_version = 2');
}

// Step 3
if (schemaVersion < 3) {
  // Migration: retro stages (v5 redesign). A staged retro moves through
  // setup → writing → voting → discussing, driven by its facilitator;
  // `phase` stays NULL for a simple retro, which behaves exactly as before.
  // `status` still says active/finished. entries.participant_id records who
  // wrote a note (a user id or an anon: participant id — never sent to
  // clients), so a staged retro can show each person their own notes while
  // hiding everyone else's until voting starts.
  try {
    const retrosInfo = db.pragma('table_info(retros)');
    const entriesInfo = db.pragma('table_info(entries)');
    if (!retrosInfo.some((col) => col.name === 'phase')) {
      db.exec('ALTER TABLE retros ADD COLUMN phase TEXT;');
      console.log('✅ Migration applied: added phase to retros table.');
    }
    if (!retrosInfo.some((col) => col.name === 'focus_entry_id')) {
      db.exec('ALTER TABLE retros ADD COLUMN focus_entry_id TEXT;');
      console.log('✅ Migration applied: added focus_entry_id to retros table.');
    }
    if (!retrosInfo.some((col) => col.name === 'timer_ends_at')) {
      db.exec('ALTER TABLE retros ADD COLUMN timer_ends_at TEXT;');
      console.log('✅ Migration applied: added timer_ends_at to retros table.');
    }
    if (!entriesInfo.some((col) => col.name === 'participant_id')) {
      db.exec('ALTER TABLE entries ADD COLUMN participant_id TEXT;');
      console.log('✅ Migration applied: added participant_id to entries table.');
    }
  } catch (err) {
    console.error('Migration error (retro stages):', err);
  }

  db.pragma('user_version = 3');
}

// Step 4
if (schemaVersion < 4) {
  // Migration: the UI switched to English, and so did the seeded templates.
  // Translate a built-in template only while it is still exactly as the
  // Turkish seed created it — anything an admin renamed or edited is theirs
  // and stays as it is. Existing retros keep their column names.
  try {
    const translations = [
      {
        from: { name: 'Standart', columns: ['İyi Giden', 'Geliştirilmeli', 'Aksiyon'] },
        to: { name: 'Standard', columns: ['Went well', 'To improve', 'Action items'] }
      },
      {
        from: { name: 'Mad/Sad/Glad', columns: ['Mad 😠', 'Sad 😢', 'Glad 😃', 'Aksiyon 🚀'] },
        to: { name: 'Mad/Sad/Glad', columns: ['Mad 😠', 'Sad 😢', 'Glad 😃', 'Actions 🚀'] }
      }
    ];
    const update = db.prepare('UPDATE templates SET name = ?, columns = ? WHERE name = ? AND columns = ?');
    let translated = 0;
    for (const { from, to } of translations) {
      translated += update.run(to.name, JSON.stringify(to.columns), from.name, JSON.stringify(from.columns)).changes;
    }
    if (translated > 0) {
      console.log(`✅ Migration applied: translated ${translated} built-in template(s) to English.`);
    }
  } catch (err) {
    console.error('Migration error (English templates):', err);
  }

  db.pragma('user_version = 4');
}

export default db;
