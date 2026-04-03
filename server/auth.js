import db from './db.js';

/**
 * Express middleware — validates Bearer token, attaches req.user.
 * If no token or invalid, sets req.user = null (does NOT block).
 * Use requireAuth / requireAdmin for actual protection.
 */
export function loadUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (token) {
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (session) {
      req.user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.user_id);
    }
  }
  req.user = req.user || null;
  next();
}

/** Block if not authenticated */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor.' });
  next();
}

/** Block if not admin */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gereklidir.' });
  }
  next();
}
