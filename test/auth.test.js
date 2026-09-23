import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';
import db from '../server/db.js';

describe('auth', () => {
  it('registers a new user with the default "user" role', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
    expect(res.body.token).toBeTruthy();
  });

  it('rejects registration with a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'shortpw', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate username', async () => {
    await request(app).post('/api/auth/register').send({ username: 'bob', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('logs in the seeded default admin, flagged for a forced password change', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.must_change_password).toBe(true);
  });

  it('clears must_change_password once the password is actually changed', async () => {
    // Use a throwaway admin account rather than the seeded admin/admin one,
    // so this test doesn't leave that account in a mutated state.
    const registered = await request(app).post('/api/auth/register').send({ username: 'temp-admin-flow', password: 'initial1' });
    db.prepare("UPDATE users SET role = 'admin', must_change_password = 1 WHERE id = ?").run(registered.body.user.id);

    const login = await request(app).post('/api/auth/login').send({ username: 'temp-admin-flow', password: 'initial1' });
    expect(login.body.user.must_change_password).toBe(true);

    await request(app)
      .put(`/api/users/${login.body.user.id}/password`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ password: 'a-much-better-password' });

    const relogin = await request(app).post('/api/auth/login').send({ username: 'temp-admin-flow', password: 'a-much-better-password' });
    expect(relogin.body.user.must_change_password).toBe(false);
  });

  it('refuses the API to a flagged account until its password is changed', async () => {
    const registered = await request(app).post('/api/auth/register').send({ username: 'flagged-admin', password: 'initial1' });
    const victim = await request(app).post('/api/auth/register').send({ username: 'flagged-victim', password: 'initial1' });
    db.prepare("UPDATE users SET role = 'admin', must_change_password = 1 WHERE id = ?").run(registered.body.user.id);
    const login = await request(app).post('/api/auth/login').send({ username: 'flagged-admin', password: 'initial1' });
    const auth = { Authorization: `Bearer ${login.body.token}` };

    const listUsers = await request(app).get('/api/users').set(auth);
    expect(listUsers.status).toBe(403);
    expect(listUsers.body.must_change_password).toBe(true);
    expect((await request(app).post('/api/retros').set(auth).send({ title: 'x', columns: ['a'] })).status).toBe(403);
    expect((await request(app).put(`/api/users/${victim.body.user.id}/password`).set(auth).send({ password: 'hijacked1' })).status).toBe(403);

    // Still reachable: who am I, and changing its own password
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(200);
    const change = await request(app).put(`/api/users/${login.body.user.id}/password`).set(auth).send({ password: 'a-real-password' });
    expect(change.status).toBe(200);

    expect((await request(app).get('/api/users').set(auth)).status).toBe(200);
  });

  it('refuses admin actions to the seeded admin/admin account', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin' });
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ username: 'sneaky', password: 'sneaky123' });
    expect(res.status).toBe(403);
  });

  it('rejects the wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('blocks /auth/me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token, then invalidates it on logout', async () => {
    const login = await request(app).post('/api/auth/register').send({ username: 'carol', password: 'password123' });
    const token = login.body.token;

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.username).toBe('carol');

    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(200);

    const meAfter = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meAfter.status).toBe(401);
  });

  it('rejects a session past its expires_at', async () => {
    const login = await request(app).post('/api/auth/register').send({ username: 'dave', password: 'password123' });
    const { token } = login.body;

    // Simulate time passing — sessions are otherwise valid for 30 days.
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
      .run(new Date(Date.now() - 1000).toISOString(), token);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rate-limits repeated login attempts (limiter is skipped elsewhere in this suite via NODE_ENV=test)', async () => {
    process.env.NODE_ENV = 'production';
    try {
      let last;
      for (let i = 0; i < 11; i++) {
        last = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong-password' });
      }
      expect(last.status).toBe(429);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });
});
