import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { requireAuth, requireAuthAllowPending, requireAdmin } from './auth.js';

const router = Router();

// Broadcaster — injected from index.js after WS setup
let broadcast = () => {};
export function setBroadcast(fn) { broadcast = fn; }

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const skipInTests = () => process.env.NODE_ENV === 'test';

// Generous enough for a genuine forgotten-password retry, tight enough to
// make brute-forcing a login or mass-creating accounts impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Çok fazla giriş denemesi. Lütfen birkaç dakika sonra tekrar deneyin.' }
});

// Guards the current-password check on PUT /users/:id/password against
// being used to brute-force a password with a stolen session token.
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Çok fazla şifre değiştirme denemesi. Lütfen birkaç dakika sonra tekrar deneyin.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.' }
});

// Public board writes need no login, so this per-IP budget is what stops
// a script from stuffing votes by rotating participant_ids. Generous,
// because a whole team in one office can share a single IP.
const boardWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Çok fazla istek. Lütfen biraz bekleyip tekrar deneyin.' }
});

// Maximum lengths for user-supplied text fields
const LIMITS = {
  username: 50,
  email: 254,
  password: 200,
  title: 200,
  columnName: 100,
  templateName: 100,
  entryText: 1000,
  columnsPerRetro: 20
};

const MAX_VOTES_RANGE = { min: 1, max: 20 };

/** The trimmed string if `value` is a non-empty string of at most `max` chars, else null. */
function cleanString(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

/** For optional fields: `{ ok, value }`, where an empty/missing value is ok and becomes null. */
function optionalString(value, max) {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string' || value.trim().length > max) return { ok: false };
  return { ok: true, value: value.trim() || null };
}

/** An error message for an unacceptable new password, or null. */
function passwordError(password) {
  if (typeof password !== 'string' || password.length < 6) return 'Şifre en az 6 karakter olmalıdır.';
  if (password.length > LIMITS.password) return `Şifre en fazla ${LIMITS.password} karakter olabilir.`;
  return null;
}

function createSession(userId) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

/**
 * The identity votes are recorded under: the logged-in user's id, or — for
 * guests — the client-generated participant_id in its own `anon:` namespace.
 * Without the prefix a guest could send a real user's id (e.g. a retro
 * owner's) as their participant_id and read or withdraw that user's votes.
 */
function voterId(req, suppliedParticipantId) {
  if (req.user) return req.user.id;
  if (typeof suppliedParticipantId !== 'string' || !suppliedParticipantId || suppliedParticipantId.length > 100) {
    return null;
  }
  return `anon:${suppliedParticipantId}`;
}

const RETRO_STATUSES = ['active', 'finished'];

const RETRO_FINISHED_ERROR = { error: 'Bu retro tamamlandı; artık değişiklik yapılamaz.' };

/* ══════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════ */

// POST /api/auth/login
router.post('/auth/login', loginLimiter, (req, res) => {
  // Matched exactly, not trimmed: accounts registered before usernames were
  // trimmed may still carry surrounding spaces.
  const { username, password } = req.body;
  if (typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  const token = createSession(user.id);

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, must_change_password: !!user.must_change_password } });
});

// POST /api/auth/register — public
router.post('/auth/register', registerLimiter, (req, res) => {
  const { password } = req.body;
  const username = cleanString(req.body.username, LIMITS.username);
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  const pwdError = passwordError(password);
  if (pwdError) return res.status(400).json({ error: pwdError });
  const email = optionalString(req.body.email, LIMITS.email);
  if (!email.ok) return res.status(400).json({ error: 'Geçersiz e-posta adresi.' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });

  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)').run(id, username, hash, 'user', email.value);

  // Auto-login after registration
  const token = createSession(id);

  res.status(201).json({ token, user: { id, username, role: 'user', must_change_password: false } });
});

// POST /api/auth/logout
router.post('/auth/logout', requireAuthAllowPending, (req, res) => {
  const token = req.headers.authorization?.slice(7);
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/auth/me', requireAuthAllowPending, (req, res) => {
  res.json(req.user);
});

/* ══════════════════════════════════════════════════════════════
   USER MANAGEMENT (admin only)
══════════════════════════════════════════════════════════════ */

// GET /api/users  — list all users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// POST /api/users  — create user
router.post('/users', requireAdmin, (req, res) => {
  const { password, role = 'user' } = req.body;
  const username = cleanString(req.body.username, LIMITS.username);
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  const pwdError = passwordError(password);
  if (pwdError) return res.status(400).json({ error: pwdError });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Geçersiz rol.' });
  const email = optionalString(req.body.email, LIMITS.email);
  if (!email.ok) return res.status(400).json({ error: 'Geçersiz e-posta adresi.' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });

  const id = randomUUID();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)').run(id, username, hash, role, email.value);

  res.status(201).json({ id, username, role, email: email.value });
});

// DELETE /api/users/:id
router.delete('/users/:id', requireAdmin, (req, res) => {
  // Prevent deleting yourself
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Kendinizi silemezsiniz.' });
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ success: true });
});

// PUT /api/users/:id/password  — change password (admin or self)
router.put('/users/:id/password', passwordChangeLimiter, requireAuthAllowPending, (req, res) => {
  const isSelf = req.params.id === req.user.id;
  // An admin still on a default password can only fix its own password,
  // not reset anyone else's.
  const isAdmin = req.user.role === 'admin' && !req.user.must_change_password;
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Yetki yok.' });

  const { password, current_password: currentPassword } = req.body;
  const pwdError = passwordError(password);
  if (pwdError) return res.status(400).json({ error: pwdError });

  const target = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  // Changing your own password takes the current one, so a leaked session
  // token alone can't lock the real owner out. Not asked of an account
  // flagged must_change_password: it's on a publicly known default (e.g.
  // admin/admin), so asking for it proves nothing.
  if (isSelf && !req.user.must_change_password) {
    if (typeof currentPassword !== 'string' || !bcrypt.compareSync(currentPassword, target.password_hash)) {
      return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
    }
  }

  // A password change logs out every other session of that account — the
  // point of a reset is usually to lock someone out. Changing your own
  // keeps the session you're using.
  const keepToken = isSelf ? req.headers.authorization.slice(7) : '';
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, req.params.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.params.id, keepToken);
  })();
  res.json({ success: true });
});

// PUT /api/users/:id  — update user details (admin only)
router.put('/users/:id', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  // Validate everything before writing anything, so a bad email can't
  // leave a half-applied update behind.
  let username;
  if (req.body.username !== undefined) {
    username = cleanString(req.body.username, LIMITS.username);
    if (!username) return res.status(400).json({ error: 'Geçersiz kullanıcı adı.' });
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.params.id);
    if (existing) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });
  }
  const email = req.body.email !== undefined ? optionalString(req.body.email, LIMITS.email) : null;
  if (email && !email.ok) return res.status(400).json({ error: 'Geçersiz e-posta adresi.' });

  if (username !== undefined) {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.params.id);
  }
  if (email) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.value, req.params.id);
  }

  const updated = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/* ══════════════════════════════════════════════════════════════
   RETRO TEMPLATES — global, visible to everyone. Management is
   admin-only.
══════════════════════════════════════════════════════════════ */

/**
 * Parses a column-name list shared by templates and retro creation:
 * `{ columns }` with every name trimmed, or `{ error }`.
 */
function parseColumnNames(columns) {
  if (!Array.isArray(columns) || columns.length === 0) return { error: 'En az bir geçerli sütun gereklidir.' };
  if (columns.length > LIMITS.columnsPerRetro) {
    return { error: `En fazla ${LIMITS.columnsPerRetro} sütun eklenebilir.` };
  }
  const names = columns.map(c => cleanString(c, LIMITS.columnName));
  if (names.some(n => !n)) {
    return { error: `Sütun adları boş olamaz ve en fazla ${LIMITS.columnName} karakter olabilir.` };
  }
  return { columns: names };
}

/** `{ name, columns }` with trimmed values, or `{ error }`. */
function parseTemplateBody(body) {
  const name = cleanString(body.name, LIMITS.templateName);
  if (!name) return { error: 'Şablon adı gereklidir.' };
  const parsed = parseColumnNames(body.columns);
  if (parsed.error) return { error: parsed.error };
  return { name, columns: parsed.columns };
}

// GET /api/templates
router.get('/templates', requireAuth, (req, res) => {
  const templates = db.prepare('SELECT * FROM templates ORDER BY sort_order').all();
  res.json(templates.map(t => ({ ...t, columns: JSON.parse(t.columns) })));
});

// POST /api/templates
router.post('/templates', requireAdmin, (req, res) => {
  const { error, name, columns } = parseTemplateBody(req.body);
  if (error) return res.status(400).json({ error });

  const id = randomUUID();
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM templates').get().next;

  db.prepare('INSERT INTO templates (id, name, columns, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name, JSON.stringify(columns), sortOrder);

  res.status(201).json({ id, name, columns, sort_order: sortOrder });
});

// PUT /api/templates/:id
router.put('/templates/:id', requireAdmin, (req, res) => {
  const { error, name, columns } = parseTemplateBody(req.body);
  if (error) return res.status(400).json({ error });

  db.prepare('UPDATE templates SET name = ?, columns = ? WHERE id = ?')
    .run(name, JSON.stringify(columns), req.params.id);

  const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Şablon bulunamadı.' });
  res.json({ ...updated, columns: JSON.parse(updated.columns) });
});

// DELETE /api/templates/:id
router.delete('/templates/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Şablon bulunamadı.' });
  res.json({ success: true });
});

/* ══════════════════════════════════════════════════════════════
   RETRO ROUTES
══════════════════════════════════════════════════════════════ */

// GET /api/retros
router.get('/retros', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const baseQuery = `SELECT r.* FROM retros r`;
  const query = isAdmin
    ? `${baseQuery} ORDER BY r.created_at DESC`
    : `${baseQuery} WHERE r.created_by = ? ORDER BY r.created_at DESC`;
  const params = isAdmin ? [] : [req.user.id];

  const retros = db.prepare(query).all(...params);
  res.json(retros);
});

function generateShortCode() {
  return Math.random().toString(36).substring(2, 8);
}

function createUniqueShortCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateShortCode();
    const row = db.prepare('SELECT id FROM retros WHERE short_code = ?').get(code);
    if (!row) exists = false;
  }
  return code;
}

// POST /api/retros  — allow any authenticated user
router.post('/retros', requireAuth, (req, res) => {
  const { max_votes } = req.body;
  const title = cleanString(req.body.title, LIMITS.title);
  if (!title) {
    return res.status(400).json({ error: `Başlık gereklidir (en fazla ${LIMITS.title} karakter).` });
  }
  const parsedColumns = parseColumnNames(req.body.columns);
  if (parsedColumns.error) return res.status(400).json({ error: parsedColumns.error });
  const columns = parsedColumns.columns;

  const votes = max_votes === undefined || max_votes === null || max_votes === '' ? 3 : Number(max_votes);
  if (!Number.isInteger(votes) || votes < MAX_VOTES_RANGE.min || votes > MAX_VOTES_RANGE.max) {
    return res.status(400).json({ error: `Oy hakkı ${MAX_VOTES_RANGE.min} ile ${MAX_VOTES_RANGE.max} arasında olmalıdır.` });
  }

  const retroId = randomUUID();
  const shortCode = createUniqueShortCode();
  const insertRetro = db.prepare('INSERT INTO retros (id, title, max_votes, created_by, short_code) VALUES (?, ?, ?, ?, ?)');
  const insertColumn = db.prepare('INSERT INTO columns (id, retro_id, name, sort_order) VALUES (?, ?, ?, ?)');

  db.transaction(() => {
    insertRetro.run(retroId, title, votes, req.user.id, shortCode);
    columns.forEach((colName, idx) => { insertColumn.run(randomUUID(), retroId, colName, idx); });
  })();

  res.status(201).json({ id: retroId, title, short_code: shortCode });
});

// GET /api/retros/:id
router.get('/retros/:id', (req, res) => {
  const retro = db.prepare('SELECT * FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });

  const columns = db.prepare('SELECT * FROM columns WHERE retro_id = ? ORDER BY sort_order').all(req.params.id);
  const entries = db.prepare('SELECT * FROM entries WHERE retro_id = ? ORDER BY created_at').all(req.params.id);

  const columnData = columns.map(col => ({
    ...col,
    entries: entries.filter(e => e.column_id === col.id)
  }));

  // Tell the caller which entries *they* (this authenticated user, or this
  // anonymous participant_id) have already voted for, so the client no
  // longer has to trust its own localStorage as the source of truth.
  const participantId = voterId(req, req.query.participant_id);
  const votedEntryIds = participantId
    ? db.prepare('SELECT entry_id FROM votes WHERE retro_id = ? AND participant_id = ?')
        .all(req.params.id, participantId).map(v => v.entry_id)
    : [];

  // The owner's user id stays server-side — the board only needs to know
  // whether *this* caller owns it.
  const { created_by, ...publicRetro } = retro;
  const isOwner = !!req.user && req.user.id === created_by;

  res.json({ ...publicRetro, is_owner: isOwner, columns: columnData, voted_entry_ids: votedEntryIds });
});

// DELETE /api/retros/:id  — admin or owner only
router.delete('/retros/:id', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu silme yetkiniz yok.' });
  }

  db.prepare('DELETE FROM retros WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// PUT /api/retros/:id/columns/:colId  — rename column (admin or owner only,
// and only before anyone's added an entry anywhere on the board — see the
// matching check on POST .../columns)
router.put('/retros/:id/columns/:colId', requireAuth, (req, res) => {
  const name = cleanString(req.body.name, LIMITS.columnName);
  if (!name) return res.status(400).json({ error: `Sütun adı gereklidir (en fazla ${LIMITS.columnName} karakter).` });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);

  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu düzenleme yetkiniz yok.' });
  }

  const entryCount = db.prepare('SELECT COUNT(*) as count FROM entries WHERE retro_id = ?').get(req.params.id).count;
  if (entryCount > 0) {
    return res.status(403).json({ error: 'Madde eklendikten sonra sütun adı değiştirilemez.' });
  }

  const result = db.prepare('UPDATE columns SET name = ? WHERE id = ? AND retro_id = ?')
    .run(name, req.params.colId, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Sütun bulunamadı.' });

  // Broadcast to all clients in this retro room
  broadcast(req.params.id, { type: 'column:renamed', columnId: req.params.colId, name });

  res.json({ success: true });
});

// POST /api/retros/:id/columns  — add a column (admin or owner only, and
// only before anyone's added an entry anywhere on the board — adding a
// lane mid-retro would be confusing once people are already using the
// existing ones)
router.post('/retros/:id/columns', requireAuth, (req, res) => {
  const name = cleanString(req.body.name, LIMITS.columnName);
  if (!name) return res.status(400).json({ error: `Sütun adı gereklidir (en fazla ${LIMITS.columnName} karakter).` });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu düzenleme yetkiniz yok.' });
  }

  const entryCount = db.prepare('SELECT COUNT(*) as count FROM entries WHERE retro_id = ?').get(req.params.id).count;
  if (entryCount > 0) {
    return res.status(403).json({ error: 'Madde eklendikten sonra yeni sütun eklenemez.' });
  }

  const columnCount = db.prepare('SELECT COUNT(*) as count FROM columns WHERE retro_id = ?').get(req.params.id).count;
  if (columnCount >= LIMITS.columnsPerRetro) {
    return res.status(400).json({ error: `En fazla ${LIMITS.columnsPerRetro} sütun eklenebilir.` });
  }
  const columnId = randomUUID();
  db.prepare('INSERT INTO columns (id, retro_id, name, sort_order) VALUES (?, ?, ?, ?)')
    .run(columnId, req.params.id, name, columnCount);

  const column = { id: columnId, retro_id: req.params.id, name, sort_order: columnCount, entries: [] };
  broadcast(req.params.id, { type: 'column:added', column });
  res.status(201).json(column);
});

// DELETE /api/retros/:id/columns/:colId  — remove a column (admin or owner only)
router.delete('/retros/:id/columns/:colId', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu düzenleme yetkiniz yok.' });
  }

  const columnCount = db.prepare('SELECT COUNT(*) as count FROM columns WHERE retro_id = ?').get(req.params.id).count;
  if (columnCount <= 1) return res.status(400).json({ error: 'En az bir sütun kalmalıdır.' });

  const result = db.prepare('DELETE FROM columns WHERE id = ? AND retro_id = ?').run(req.params.colId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Sütun bulunamadı.' });

  broadcast(req.params.id, { type: 'column:deleted', columnId: req.params.colId });
  res.json({ success: true });
});

// POST /api/retros/:id/entries  — add entry. Entries are always anonymous:
// any `author` in the body is ignored, so nobody can post under someone
// else's name.
router.post('/retros/:id/entries', boardWriteLimiter, (req, res) => {
  const { column_id } = req.body;
  const text = cleanString(req.body.text, LIMITS.entryText);
  if (typeof column_id !== 'string' || !column_id || !text) {
    return res.status(400).json({ error: `column_id ve text gereklidir (en fazla ${LIMITS.entryText} karakter).` });
  }

  const retro = db.prepare('SELECT status FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (retro.status === 'finished') return res.status(409).json(RETRO_FINISHED_ERROR);

  const column = db.prepare('SELECT id FROM columns WHERE id = ? AND retro_id = ?').get(column_id, req.params.id);
  if (!column) return res.status(400).json({ error: 'Sütun bu retroya ait değil.' });

  const entryId = randomUUID();
  const authorName = 'Anonim';
  db.prepare('INSERT INTO entries (id, column_id, retro_id, text, author) VALUES (?, ?, ?, ?, ?)')
    .run(entryId, column_id, req.params.id, text, authorName);

  const entry = { id: entryId, column_id, retro_id: req.params.id, text, author: authorName, votes: 0 };

  // Broadcast
  broadcast(req.params.id, { type: 'entry:added', entry });

  res.status(201).json(entry);
});

// PUT /api/retros/:id/entries/:entryId  — edit entry text (admin or retro owner)
router.put('/retros/:id/entries/:entryId', requireAuth, (req, res) => {
  const text = cleanString(req.body.text, LIMITS.entryText);
  if (!text) return res.status(400).json({ error: `Metin gereklidir (en fazla ${LIMITS.entryText} karakter).` });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu girdiyi düzenleme yetkiniz yok.' });
  }

  const result = db.prepare('UPDATE entries SET text = ? WHERE id = ? AND retro_id = ?')
    .run(text, req.params.entryId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);
  broadcast(req.params.id, { type: 'entry:edited', entry });
  res.json(entry);
});

// PUT /api/retros/:id/entries/:entryId/move  — move entry to a different column (admin or retro owner)
router.put('/retros/:id/entries/:entryId/move', requireAuth, (req, res) => {
  const { column_id } = req.body;
  if (typeof column_id !== 'string' || !column_id) return res.status(400).json({ error: 'column_id gereklidir.' });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu girdiyi taşıma yetkiniz yok.' });
  }

  const targetColumn = db.prepare('SELECT id FROM columns WHERE id = ? AND retro_id = ?').get(column_id, req.params.id);
  if (!targetColumn) return res.status(400).json({ error: 'Hedef sütun bu retroya ait değil.' });

  const result = db.prepare('UPDATE entries SET column_id = ? WHERE id = ? AND retro_id = ?')
    .run(column_id, req.params.entryId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);
  broadcast(req.params.id, { type: 'entry:moved', entry });
  res.json(entry);
});

// DELETE /api/retros/:id/entries/:entryId  — delete entry (admin or retro owner)
router.delete('/retros/:id/entries/:entryId', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu girdiyi silme yetkiniz yok.' });
  }

  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND retro_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  db.prepare('DELETE FROM entries WHERE id = ? AND retro_id = ?').run(req.params.entryId, req.params.id);
  broadcast(req.params.id, { type: 'entry:deleted', entryId: req.params.entryId, columnId: entry.column_id });
  res.json({ success: true });
});

// POST /api/retros/:id/entries/:entryId/vote
// Enforced server-side against a participant identity: the authenticated
// user's id if logged in, otherwise a client-generated participant_id
// (localStorage-persisted) for anonymous guests.
router.post('/retros/:id/entries/:entryId/vote', boardWriteLimiter, (req, res) => {
  const participantId = voterId(req, req.body.participant_id);
  if (!participantId) return res.status(400).json({ error: 'participant_id gereklidir.' });

  const retro = db.prepare('SELECT max_votes, status FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (retro.status === 'finished') return res.status(409).json(RETRO_FINISHED_ERROR);

  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND retro_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  const existingVote = db.prepare('SELECT id FROM votes WHERE retro_id = ? AND entry_id = ? AND participant_id = ?')
    .get(req.params.id, req.params.entryId, participantId);
  if (existingVote) return res.status(409).json({ error: 'Bu girdiye zaten oy verdiniz.' });

  const votesUsed = db.prepare('SELECT COUNT(*) as count FROM votes WHERE retro_id = ? AND participant_id = ?')
    .get(req.params.id, participantId).count;
  const maxVotes = retro.max_votes ?? 3;
  if (votesUsed >= maxVotes) {
    return res.status(400).json({ error: 'Tüm oy haklarınızı kullandınız!' });
  }

  const updatedEntry = db.transaction(() => {
    db.prepare('INSERT INTO votes (id, retro_id, entry_id, participant_id) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), req.params.id, req.params.entryId, participantId);
    db.prepare('UPDATE entries SET votes = votes + 1 WHERE id = ?').run(req.params.entryId);
    return db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);
  })();

  broadcast(req.params.id, { type: 'entry:voted', entry: updatedEntry });

  res.json(updatedEntry);
});

// POST /api/retros/:id/entries/:entryId/unvote
router.post('/retros/:id/entries/:entryId/unvote', boardWriteLimiter, (req, res) => {
  const participantId = voterId(req, req.body.participant_id);
  if (!participantId) return res.status(400).json({ error: 'participant_id gereklidir.' });

  const retro = db.prepare('SELECT status FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (retro.status === 'finished') return res.status(409).json(RETRO_FINISHED_ERROR);

  const existingVote = db.prepare('SELECT id FROM votes WHERE retro_id = ? AND entry_id = ? AND participant_id = ?')
    .get(req.params.id, req.params.entryId, participantId);
  if (!existingVote) return res.status(404).json({ error: 'Bu girdiye oy vermediniz.' });

  const entry = db.transaction(() => {
    db.prepare('DELETE FROM votes WHERE id = ?').run(existingVote.id);
    db.prepare('UPDATE entries SET votes = MAX(0, votes - 1) WHERE id = ?').run(req.params.entryId);
    return db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);
  })();

  // Broadcast using entry:voted so frontend simply updates the count
  broadcast(req.params.id, { type: 'entry:voted', entry });

  res.json(entry);
});

// PUT /api/retros/:id/status
router.put('/retros/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!RETRO_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Geçersiz durum. Geçerli değerler: ${RETRO_STATUSES.join(', ')}.` });
  }

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retro durumunu değiştirme yetkiniz yok.' });
  }

  const result = db.prepare('UPDATE retros SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Retro bulunamadı.' });

  broadcast(req.params.id, { type: 'retro:status_changed', status });
  res.json({ success: true, status });
});

export default router;
