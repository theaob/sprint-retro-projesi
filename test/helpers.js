import { randomUUID } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server/app.js';
import db from '../server/db.js';

export { app };

const TEST_ADMIN = { username: 'testadmin', password: 'testadmin-pass' };

/**
 * Logs in as a ready-to-use admin account. Not the DB-seeded admin/admin —
 * that one is flagged must_change_password and the API refuses it until the
 * password changes, so tests get their own admin with a real password.
 */
export async function loginAdmin() {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(TEST_ADMIN.username);
  if (!exists) {
    db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run(randomUUID(), TEST_ADMIN.username, bcrypt.hashSync(TEST_ADMIN.password, 4));
  }
  const res = await request(app).post('/api/auth/login').send(TEST_ADMIN);
  return res.body; // { token, user }
}

/** Registers a fresh regular ('user' role) account and returns its session. */
export async function registerUser(username, password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ username, password });
  return res.body; // { token, user }
}

/** Creates a retro owned by the given session's user; returns the created retro. */
export async function createRetro(session, title, columns = ['İyi Giden', 'Geliştirilmeli']) {
  const res = await request(app)
    .post('/api/retros')
    .set('Authorization', `Bearer ${session.token}`)
    .send({ title, columns, max_votes: 3 });
  return res.body;
}
