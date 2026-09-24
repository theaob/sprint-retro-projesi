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
      if (session.expires_at && new Date(session.expires_at) <= new Date()) {
        // Expired — clean it up lazily and treat the request as unauthenticated.
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      } else {
        req.user = db.prepare(`
          SELECT id, username, role, must_change_password FROM users WHERE id = ?
        `).get(session.user_id);
      }
    }
  }
  req.user = req.user || null;
  next();
}

const PASSWORD_CHANGE_REQUIRED = {
  error: 'You need to change your password before continuing.',
  must_change_password: true
};

/**
 * Block if not authenticated. An account still flagged must_change_password
 * (e.g. the seeded admin/admin) is also blocked — the flag is enforced here,
 * not just by the login screen, so the default credentials can't be used
 * against the API directly. Routes a flagged account must still reach
 * (changing its own password, /auth/me, logout) use requireAuthAllowPending.
 */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'You need to sign in.' });
  if (req.user.must_change_password) return res.status(403).json(PASSWORD_CHANGE_REQUIRED);
  next();
}

/** Like requireAuth, but lets a must_change_password account through. */
export function requireAuthAllowPending(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'You need to sign in.' });
  next();
}

/** Block if not admin (or an admin that still has to change its password) */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'This requires admin rights.' });
  }
  if (req.user.must_change_password) return res.status(403).json(PASSWORD_CHANGE_REQUIRED);
  next();
}
