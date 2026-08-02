import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser } from './helpers.js';

describe('user management (admin only)', () => {
  let admin, regular;

  beforeAll(async () => {
    admin = await loginAdmin();
    regular = await registerUser('users-regular');
  });

  it('blocks a non-admin from listing users', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${regular.token}`);
    expect(res.status).toBe(403);
  });

  it('lets an admin list users', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('blocks a non-admin from creating a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ username: 'sneaky', password: 'password123' });
    expect(res.status).toBe(403);
  });

  it('lets an admin create and then delete a user', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ username: 'temp-user', password: 'password123', role: 'user' });
    expect(created.status).toBe(201);

    const deleted = await request(app)
      .delete(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleted.status).toBe(200);
  });

  it('prevents an admin from deleting their own account', async () => {
    const res = await request(app)
      .delete(`/api/users/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('lets an admin assign a team at creation and update it later, resolving the team name', async () => {
    const teamA = await request(app).post('/api/teams').set('Authorization', `Bearer ${admin.token}`).send({ name: 'Users Test Team A' });
    const teamB = await request(app).post('/api/teams').set('Authorization', `Bearer ${admin.token}`).send({ name: 'Users Test Team B' });

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ username: 'team-user', password: 'password123', role: 'user', team_id: teamA.body.id });
    expect(created.status).toBe(201);
    expect(created.body.team_id).toBe(teamA.body.id);
    expect(created.body.team).toBe('Users Test Team A');

    const listed = await request(app).get('/api/users').set('Authorization', `Bearer ${admin.token}`);
    const inList = listed.body.find(u => u.id === created.body.id);
    expect(inList.team).toBe('Users Test Team A');

    const updated = await request(app)
      .put(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ team_id: teamB.body.id });
    expect(updated.status).toBe(200);
    expect(updated.body.team).toBe('Users Test Team B');

    const cleared = await request(app)
      .put(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ team_id: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.team_id).toBeNull();
    expect(cleared.body.team).toBeNull();

    await request(app).delete(`/api/users/${created.body.id}`).set('Authorization', `Bearer ${admin.token}`);
  });

  it('rejects an unknown team_id', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ username: 'bad-team-user', password: 'password123', team_id: 'not-a-real-team' });
    expect(res.status).toBe(400);
  });

  it('defaults team to null when not provided', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ username: 'no-team-user', password: 'password123' });
    expect(created.status).toBe(201);
    expect(created.body.team_id).toBeNull();
    expect(created.body.team).toBeNull();

    await request(app).delete(`/api/users/${created.body.id}`).set('Authorization', `Bearer ${admin.token}`);
  });
});
