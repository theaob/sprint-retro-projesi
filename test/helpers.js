import request from 'supertest';
import app from '../server/app.js';

export { app };

/** Logs in as the DB-seeded default admin account. */
export async function loginAdmin() {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin' });
  return res.body; // { token, user }
}

/** Registers a fresh regular ('user' role) account and returns its session. */
export async function registerUser(username, password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ username, password });
  return res.body; // { token, user }
}

/** Default team label for tests that don't care which team a retro belongs
 * to — retro creation requires a non-empty team string. */
export function ensureDefaultTeam() {
  return 'Test Team';
}

/** Creates a retro owned by the given session's user; returns the created retro. */
export async function createRetro(session, title, columns = ['İyi Giden', 'Geliştirilmeli'], team = null) {
  const res = await request(app)
    .post('/api/retros')
    .set('Authorization', `Bearer ${session.token}`)
    .send({ title, columns, max_votes: 3, team: team || ensureDefaultTeam() });
  return res.body;
}
