import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { requireAuth, requireAdmin } from './auth.js';

const router = Router();

// Broadcaster — injected from index.js after WS setup
let broadcast = () => {};
export function setBroadcast(fn) { broadcast = fn; }

/* ══════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════ */

// POST /api/auth/login
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  const token = uuidv4();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// POST /api/auth/register — public
router.post('/auth/register', (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  if (password.length < 4) return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır.' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılmakta.' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)').run(id, username, hash, 'user', email || null);

  // Auto-login after registration
  const token = uuidv4();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, id);

  res.status(201).json({ token, user: { id, username, role: 'user' } });
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
  if (!password || password.length < 4) return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır.' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
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

// POST /api/retros  — allow any authenticated user
router.post('/retros', requireAuth, (req, res) => {
  const { title, columns, max_votes } = req.body;
  if (!title || !columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ error: 'Başlık ve en az bir sütun gereklidir.' });
  }

  const retroId = uuidv4();
  const votes = parseInt(max_votes, 10) || 3;
  const insertRetro = db.prepare('INSERT INTO retros (id, title, max_votes, created_by) VALUES (?, ?, ?, ?)');
  const insertColumn = db.prepare('INSERT INTO columns (id, retro_id, name, sort_order) VALUES (?, ?, ?, ?)');

  db.transaction(() => {
    insertRetro.run(retroId, title, votes, req.user.id);
    columns.forEach((colName, idx) => insertColumn.run(uuidv4(), retroId, colName, idx));
  })();

  res.status(201).json({ id: retroId, title });
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

  res.json({ ...retro, columns: columnData, action_items: actionItems });
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
router.post('/retros/:id/entries/:entryId/vote', (req, res) => {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ? AND retro_id = ?').get(req.params.entryId, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  const result = db.prepare('UPDATE entries SET votes = votes + 1 WHERE id = ? AND retro_id = ?')
    .run(req.params.entryId, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Girdi güncellenemedi.' });

  const updatedEntry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);

  // Broadcast
  broadcast(req.params.id, { type: 'entry:voted', entry: updatedEntry });

  res.json(updatedEntry);
});


// POST /api/retros/:id/entries/:entryId/unvote
router.post('/retros/:id/entries/:entryId/unvote', (req, res) => {
  const result = db.prepare('UPDATE entries SET votes = MAX(0, votes - 1) WHERE id = ? AND retro_id = ?')
    .run(req.params.entryId, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Girdi bulunamadı.' });

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.entryId);

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

// POST /api/retros/:id/entries/:entryId/actions
router.post('/retros/:id/entries/:entryId/actions', (req, res) => {
  const { content, assignee } = req.body;
  if (!content) return res.status(400).json({ error: 'Aksiyon içeriği gereklidir.' });

  const actionId = uuidv4();
  db.prepare('INSERT INTO action_items (id, retro_id, entry_id, content, assignee) VALUES (?, ?, ?, ?, ?)')
    .run(actionId, req.params.id, req.params.entryId, content, assignee || null);

  const actionItem = { id: actionId, retro_id: req.params.id, entry_id: req.params.entryId, content, assignee: assignee || null };
  
  broadcast(req.params.id, { type: 'action:added', actionItem });
  res.status(201).json(actionItem);
});

// DELETE /api/retros/:id/actions/:actionId
router.delete('/retros/:id/actions/:actionId', (req, res) => {
  const result = db.prepare('DELETE FROM action_items WHERE id = ? AND retro_id = ?')
    .run(req.params.actionId, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Aksiyon bulunamadı.' });

  broadcast(req.params.id, { type: 'action:removed', actionId: req.params.actionId, retroId: req.params.id });
  res.json({ success: true });
});

export default router;
