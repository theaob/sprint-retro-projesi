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

let cachedDefaultTeamId = null;

/**
 * A shared, idempotent default team for tests that don't care which team a
 * retro belongs to — retro creation requires a team_id. Safe to call from
 * multiple test files: the whole suite shares one throwaway DB across
 * sequential files (see global-setup.js), so this looks the team up if an
 * earlier file already created it instead of colliding on the unique name.
 */
export async function ensureDefaultTeam() {
  if (cachedDefaultTeamId) return cachedDefaultTeamId;
  const admin = await loginAdmin();
  const created = await request(app)
    .post('/api/teams')
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ name: 'Test Team' });
  if (created.status === 201) {
    cachedDefaultTeamId = created.body.id;
  } else {
    const list = await request(app).get('/api/teams').set('Authorization', `Bearer ${admin.token}`);
    cachedDefaultTeamId = list.body.find(t => t.name === 'Test Team').id;
  }
  return cachedDefaultTeamId;
}

/** Creates a retro owned by the given session's user; returns the created retro. */
export async function createRetro(session, title, columns = ['İyi Giden', 'Geliştirilmeli'], teamId = null) {
  const team_id = teamId || await ensureDefaultTeam();
  const res = await request(app)
    .post('/api/retros')
    .set('Authorization', `Bearer ${session.token}`)
    .send({ title, columns, max_votes: 3, team_id });
  return res.body;
}
