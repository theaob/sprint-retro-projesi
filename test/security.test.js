import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser, createRetro } from './helpers.js';

// Rate limiters are skipped under NODE_ENV=test for the rest of the suite;
// these tests switch it off briefly to exercise them. Each test file gets
// fresh module instances, so the limiters' counters start at zero here.
async function withLimitersOn(fn) {
  process.env.NODE_ENV = 'production';
  try {
    await fn();
  } finally {
    process.env.NODE_ENV = 'test';
  }
}

describe('rate limiting', () => {
  it('does not trust X-Forwarded-For unless TRUST_PROXY is set', async () => {
    expect(app.get('trust proxy')).toBe(false);

    await withLimitersOn(async () => {
      let last;
      for (let i = 0; i < 11; i++) {
        last = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', `203.0.113.${i}`) // a fresh "IP" every time
          .send({ username: 'nobody', password: 'wrong-password' });
      }
      expect(last.status).toBe(429);
    });
  });

  it('limits how fast one client can post to a public board', async () => {
    const owner = await registerUser('limit-owner');
    const retro = await createRetro(owner, 'Limit Retro');
    const board = await request(app).get(`/api/retros/${retro.id}`);
    const columnId = board.body.columns[0].id;

    await withLimitersOn(async () => {
      const statuses = [];
      for (let i = 0; i < 101; i++) {
        const res = await request(app)
          .post(`/api/retros/${retro.id}/entries`)
          .send({ column_id: columnId, text: `Entry ${i}` });
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 100).every((s) => s === 201)).toBe(true);
      expect(statuses[100]).toBe(429);
    });
  });
});

describe('password changes', () => {
  let user;

  beforeAll(async () => {
    user = await registerUser('pwd-user', 'original-pass');
  });

  const changeOwn = (session, body) => request(app)
    .put(`/api/users/${session.user.id}/password`)
    .set('Authorization', `Bearer ${session.token}`)
    .send(body);

  it('requires the current password to change your own', async () => {
    expect((await changeOwn(user, { password: 'new-pass-1' })).status).toBe(400);
    expect((await changeOwn(user, { password: 'new-pass-1', current_password: 'wrong' })).status).toBe(400);
  });

  it('logs out your other sessions but keeps the current one', async () => {
    const other = (await request(app).post('/api/auth/login').send({ username: 'pwd-user', password: 'original-pass' })).body;

    const res = await changeOwn(user, { password: 'new-pass-1', current_password: 'original-pass' });
    expect(res.status).toBe(200);

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${user.token}`)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${other.token}`)).status).toBe(401);
  });

  it('logs out every session of a user an admin resets', async () => {
    const admin = await loginAdmin();
    const victim = await registerUser('reset-victim', 'victim-pass');

    const res = await request(app)
      .put(`/api/users/${victim.user.id}/password`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'admin-set-pass' });
    expect(res.status).toBe(200);

    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${victim.token}`)).status).toBe(401);
  });
});
