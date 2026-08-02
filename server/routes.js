import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { requireAuth, requireAdmin } from './auth.js';

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

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Çok fazla kayıt denemesi. Lütfen daha sonra tekrar deneyin.' }
});

function createSession(userId) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

/* ══════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════ */

// POST /api/auth/login
router.post('/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  const token = createSession(user.id);

  res.json({ token, user: { id: user.id, username: user.username, role: user.role, must_change_password: !!user.must_change_password } });
});

// POST /api/auth/register — public
router.post('/auth/register', registerLimiter, (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)').run(id, username, hash, 'user', email || null);

  // Auto-login after registration
  const token = createSession(id);

  res.status(201).json({ token, user: { id, username, role: 'user', must_change_password: false } });
});

// POST /api/auth/logout
router.post('/auth/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization?.slice(7);
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

/* ══════════════════════════════════════════════════════════════
   USER MANAGEMENT (admin only)
══════════════════════════════════════════════════════════════ */

// GET /api/users  — list all users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/users  — create user
router.post('/users', requireAdmin, (req, res) => {
  const { username, password, role = 'user', email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'Geçersiz rol.' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)').run(id, username, hash, role, email || null);
  res.status(201).json({ id, username, role, email: email || null });
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
router.put('/users/:id/password', requireAuth, (req, res) => {
  const isSelf = req.params.id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) return res.status(403).json({ error: 'Yetki yok.' });

  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true });
});

// PUT /api/users/:id  — update user details (admin only)
router.put('/users/:id', requireAdmin, (req, res) => {
  const { email, username } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

  if (username !== undefined) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.params.id);
    if (existing) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), req.params.id);
  }
  if (email !== undefined) {
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.trim() || null, req.params.id);
  }

  const updated = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

/* ══════════════════════════════════════════════════════════════
   RETRO TEMPLATES — a global, shared resource (not scoped to a single
   retro's owner), so management is admin-only like user management.
   Any authenticated user can read them, for the create-retro form.
══════════════════════════════════════════════════════════════ */

function validateTemplateBody(body) {
  const { name, columns } = body;
  if (!name || !name.trim()) return 'Şablon adı gereklidir.';
  if (!Array.isArray(columns) || columns.length === 0 || columns.some(c => !c || !c.trim())) {
    return 'En az bir geçerli sütun gereklidir.';
  }
  return null;
}

// GET /api/templates
router.get('/templates', requireAuth, (req, res) => {
  const templates = db.prepare('SELECT * FROM templates ORDER BY sort_order').all();
  res.json(templates.map(t => ({ ...t, columns: JSON.parse(t.columns) })));
});

// POST /api/templates
router.post('/templates', requireAdmin, (req, res) => {
  const error = validateTemplateBody(req.body);
  if (error) return res.status(400).json({ error });

  const { name, columns } = req.body;
  const trimmedColumns = columns.map(c => c.trim());
  const id = uuidv4();
  const sortOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM templates').get().next;

  db.prepare('INSERT INTO templates (id, name, columns, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), JSON.stringify(trimmedColumns), sortOrder);

  res.status(201).json({ id, name: name.trim(), columns: trimmedColumns, sort_order: sortOrder });
});

// PUT /api/templates/:id
router.put('/templates/:id', requireAdmin, (req, res) => {
  const error = validateTemplateBody(req.body);
  if (error) return res.status(400).json({ error });

  const { name, columns } = req.body;
  const trimmedColumns = columns.map(c => c.trim());
  const result = db.prepare('UPDATE templates SET name = ?, columns = ? WHERE id = ?')
    .run(name.trim(), JSON.stringify(trimmedColumns), req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Şablon bulunamadı.' });
  res.json({ id: req.params.id, name: name.trim(), columns: trimmedColumns });
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
  let query = 'SELECT * FROM retros ORDER BY created_at DESC';
  let params = [];

  if (!isAdmin) {
    query = 'SELECT * FROM retros WHERE created_by = ? ORDER BY created_at DESC';
    params = [req.user.id];
  }

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
  const { title, columns, max_votes } = req.body;
  if (!title || !columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ error: 'Başlık ve en az bir sütun gereklidir.' });
  }

  const retroId = uuidv4();
  const votes = parseInt(max_votes, 10) || 3;
  const shortCode = createUniqueShortCode();
  const insertRetro = db.prepare('INSERT INTO retros (id, title, max_votes, created_by, short_code) VALUES (?, ?, ?, ?, ?)');
  const insertColumn = db.prepare('INSERT INTO columns (id, retro_id, name, sort_order) VALUES (?, ?, ?, ?)');

  db.transaction(() => {
    insertRetro.run(retroId, title, votes, req.user.id, shortCode);
    columns.forEach((colName, idx) => { insertColumn.run(uuidv4(), retroId, colName, idx); });
  })();

  res.status(201).json({ id: retroId, title, short_code: shortCode });
});

// GET /api/retros/:id
router.get('/retros/:id', (req, res) => {
  const retro = db.prepare('SELECT * FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });

  const columns = db.prepare('SELECT * FROM columns WHERE retro_id = ? ORDER BY sort_order').all(req.params.id);
  const entries = db.prepare('SELECT * FROM entries WHERE retro_id = ? ORDER BY created_at').all(req.params.id);
  const actionItems = db.prepare('SELECT * FROM action_items WHERE retro_id = ? ORDER BY created_at').all(req.params.id);

  const columnData = columns.map(col => ({
    ...col,
    entries: entries.filter(e => e.column_id === col.id)
  }));

  // Tell the caller which entries *they* (this authenticated user, or this
  // anonymous participant_id) have already voted for, so the client no
  // longer has to trust its own localStorage as the source of truth.
  const participantId = req.user?.id || req.query.participant_id;
  const votedEntryIds = participantId
    ? db.prepare('SELECT entry_id FROM votes WHERE retro_id = ? AND participant_id = ?')
        .all(req.params.id, participantId).map(v => v.entry_id)
    : [];

  res.json({ ...retro, columns: columnData, action_items: actionItems, voted_entry_ids: votedEntryIds });
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

// PUT /api/retros/:id/columns/reorder  — reorder columns (admin or owner only)
// Registered before the /:colId rename route below — otherwise Express would
// match "reorder" as a wildcard colId and this route would never be reached.
router.put('/retros/:id/columns/reorder', requireAuth, (req, res) => {
  const { column_ids } = req.body;
  if (!Array.isArray(column_ids) || column_ids.length === 0) {
    return res.status(400).json({ error: 'column_ids gereklidir.' });
  }

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu düzenleme yetkiniz yok.' });
  }

  const existing = db.prepare('SELECT id FROM columns WHERE retro_id = ?').all(req.params.id).map(c => c.id);
  const sameSet = existing.length === column_ids.length && existing.every(id => column_ids.includes(id));
  if (!sameSet) return res.status(400).json({ error: 'Geçersiz sütun listesi.' });

  const updateStmt = db.prepare('UPDATE columns SET sort_order = ? WHERE id = ?');
  db.transaction(() => {
    column_ids.forEach((colId, idx) => { updateStmt.run(idx, colId); });
  })();

  broadcast(req.params.id, { type: 'columns:reordered', columnIds: column_ids });
  res.json({ success: true });
});

// PUT /api/retros/:id/columns/:colId  — rename column (admin or owner only)
router.put('/retros/:id/columns/:colId', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Sütun adı gereklidir.' });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu düzenleme yetkiniz yok.' });
  }

  const result = db.prepare('UPDATE columns SET name = ? WHERE id = ? AND retro_id = ?')
    .run(name, req.params.colId, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Sütun bulunamadı.' });

  // Broadcast to all clients in this retro room
  broadcast(req.params.id, { type: 'column:renamed', columnId: req.params.colId, name });

  res.json({ success: true });
});

// POST /api/retros/:id/columns  — add a column (admin or owner only)
router.post('/retros/:id/columns', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Sütun adı gereklidir.' });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu retroyu düzenleme yetkiniz yok.' });
  }

  const columnCount = db.prepare('SELECT COUNT(*) as count FROM columns WHERE retro_id = ?').get(req.params.id).count;
  const columnId = uuidv4();
  db.prepare('INSERT INTO columns (id, retro_id, name, sort_order) VALUES (?, ?, ?, ?)')
    .run(columnId, req.params.id, name.trim(), columnCount);

  const column = { id: columnId, retro_id: req.params.id, name: name.trim(), sort_order: columnCount, entries: [] };
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

// POST /api/retros/:id/entries  — add entry
router.post('/retros/:id/entries', (req, res) => {
  const { column_id, text, author } = req.body;
  if (!column_id || !text) return res.status(400).json({ error: 'column_id ve text gereklidir.' });

  const entryId = uuidv4();
  const authorName = author || 'Anonim';
  db.prepare('INSERT INTO entries (id, column_id, retro_id, text, author) VALUES (?, ?, ?, ?, ?)')
    .run(entryId, column_id, req.params.id, text, authorName);

  const entry = { id: entryId, column_id, retro_id: req.params.id, text, author: authorName, votes: 0 };

  // Broadcast
  broadcast(req.params.id, { type: 'entry:added', entry });

  res.status(201).json(entry);
});

// PUT /api/retros/:id/entries/:entryId  — edit entry text (admin or retro owner)
router.put('/retros/:id/entries/:entryId', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Metin gereklidir.' });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Bu girdiyi düzenleme yetkiniz yok.' });
  }

  const result = db.prepare('UPDATE entries SET text = ? WHERE id = ? AND retro_id = ?')
    .run(text.trim(), req.params.entryId, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);
  broadcast(req.params.id, { type: 'entry:edited', entry });
  res.json(entry);
});

// PUT /api/retros/:id/entries/:entryId/move  — move entry to a different column (admin or retro owner)
router.put('/retros/:id/entries/:entryId/move', requireAuth, (req, res) => {
  const { column_id } = req.body;
  if (!column_id) return res.status(400).json({ error: 'column_id gereklidir.' });

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
router.post('/retros/:id/entries/:entryId/vote', (req, res) => {
  const participantId = req.user?.id || req.body.participant_id;
  if (!participantId) return res.status(400).json({ error: 'participant_id gereklidir.' });

  const retro = db.prepare('SELECT max_votes FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });

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
      .run(uuidv4(), req.params.id, req.params.entryId, participantId);
    db.prepare('UPDATE entries SET votes = votes + 1 WHERE id = ?').run(req.params.entryId);
    return db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);
  })();

  broadcast(req.params.id, { type: 'entry:voted', entry: updatedEntry });

  res.json(updatedEntry);
});

// POST /api/retros/:id/entries/:entryId/unvote
router.post('/retros/:id/entries/:entryId/unvote', (req, res) => {
  const participantId = req.user?.id || req.body.participant_id;
  if (!participantId) return res.status(400).json({ error: 'participant_id gereklidir.' });

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
  if (!status) return res.status(400).json({ error: 'Status gereklidir.' });

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

// POST /api/retros/:id/entries/:entryId/actions — Scrum Master (retro owner) or admin only
router.post('/retros/:id/entries/:entryId/actions', requireAuth, (req, res) => {
  const { content, assignee, due_date } = req.body;
  if (!content) return res.status(400).json({ error: 'Aksiyon içeriği gereklidir.' });

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Aksiyon ekleme yetkiniz yok. Bu işlem Scrum Master\'a aittir.' });
  }

  const actionId = uuidv4();
  db.prepare('INSERT INTO action_items (id, retro_id, entry_id, content, assignee, due_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(actionId, req.params.id, req.params.entryId, content, assignee || null, due_date || null);

  const actionItem = {
    id: actionId, retro_id: req.params.id, entry_id: req.params.entryId,
    content, assignee: assignee || null, due_date: due_date || null, done: 0
  };

  broadcast(req.params.id, { type: 'action:added', actionItem });
  res.status(201).json(actionItem);
});

// PUT /api/retros/:id/actions/:actionId — update done/due_date (Scrum Master or admin only)
router.put('/retros/:id/actions/:actionId', requireAuth, (req, res) => {
  const { done, due_date } = req.body;
  if (done === undefined && due_date === undefined) {
    return res.status(400).json({ error: 'Güncellenecek bir alan gereklidir.' });
  }

  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Aksiyon güncelleme yetkiniz yok. Bu işlem Scrum Master\'a aittir.' });
  }

  const existing = db.prepare('SELECT * FROM action_items WHERE id = ? AND retro_id = ?').get(req.params.actionId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Aksiyon bulunamadı.' });

  const nextDone = done !== undefined ? (done ? 1 : 0) : existing.done;
  const nextDueDate = due_date !== undefined ? (due_date || null) : existing.due_date;

  db.prepare('UPDATE action_items SET done = ?, due_date = ? WHERE id = ?').run(nextDone, nextDueDate, req.params.actionId);

  const actionItem = db.prepare('SELECT * FROM action_items WHERE id = ?').get(req.params.actionId);
  broadcast(req.params.id, { type: 'action:updated', actionItem });
  res.json(actionItem);
});

// DELETE /api/retros/:id/actions/:actionId — Scrum Master (retro owner) or admin only
router.delete('/retros/:id/actions/:actionId', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const retro = db.prepare('SELECT created_by FROM retros WHERE id = ?').get(req.params.id);
  if (!retro) return res.status(404).json({ error: 'Retro bulunamadı.' });
  if (!isAdmin && retro.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Aksiyon silme yetkiniz yok. Bu işlem Scrum Master\'a aittir.' });
  }

  const result = db.prepare('DELETE FROM action_items WHERE id = ? AND retro_id = ?')
    .run(req.params.actionId, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Aksiyon bulunamadı.' });

  broadcast(req.params.id, { type: 'action:removed', actionId: req.params.actionId, retroId: req.params.id });
  res.json({ success: true });
});

// GET /api/action-items/open — open (not done) action items across the
// caller's own retros (all retros if admin), for the "open actions" view.
router.get('/action-items/open', requireAuth, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const query = isAdmin
    ? `SELECT a.*, r.title AS retro_title, r.status AS retro_status
       FROM action_items a
       JOIN retros r ON r.id = a.retro_id
       WHERE a.done = 0
       ORDER BY (a.due_date IS NULL), a.due_date ASC, a.created_at ASC`
    : `SELECT a.*, r.title AS retro_title, r.status AS retro_status
       FROM action_items a
       JOIN retros r ON r.id = a.retro_id
       WHERE a.done = 0 AND r.created_by = ?
       ORDER BY (a.due_date IS NULL), a.due_date ASC, a.created_at ASC`;

  const items = isAdmin ? db.prepare(query).all() : db.prepare(query).all(req.user.id);
  res.json(items);
});

export default router;
