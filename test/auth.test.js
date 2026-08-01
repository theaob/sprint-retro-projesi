import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';

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

  it('logs in the seeded default admin', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
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
});
