import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser } from './helpers.js';

describe('teams', () => {
  let admin, regular;

  beforeAll(async () => {
    admin = await loginAdmin();
    regular = await registerUser('teams-regular');
  });

  it('requires auth to list teams', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(401);
  });

  it('lets any authenticated user list teams', async () => {
    const res = await request(app).get('/api/teams').set('Authorization', `Bearer ${regular.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('blocks a non-admin from creating a team', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ name: 'Sneaky Team' });
    expect(res.status).toBe(403);
  });

  it('rejects a blank team name', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '  ' });
    expect(res.status).toBe(400);
  });

  it('lets an admin create, rename, and delete a team', async () => {
    const created = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'CRUD Team' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('CRUD Team');

    const renamed = await request(app)
      .put(`/api/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Renamed Team' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Renamed Team');

    const listed = await request(app).get('/api/teams').set('Authorization', `Bearer ${regular.token}`);
    expect(listed.body.map(t => t.name)).toContain('Renamed Team');

    const deleted = await request(app)
      .delete(`/api/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleted.status).toBe(200);

    const afterDelete = await request(app).get('/api/teams').set('Authorization', `Bearer ${regular.token}`);
    expect(afterDelete.body.map(t => t.name)).not.toContain('Renamed Team');
  });

  it('rejects a duplicate team name', async () => {
    const first = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Duplicate Team' });
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Duplicate Team' });
    expect(duplicate.status).toBe(409);
  });

  it('blocks a non-admin from updating or deleting a team', async () => {
    const created = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Protected Team' });

    const updateBlocked = await request(app)
      .put(`/api/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ name: 'Hacked' });
    expect(updateBlocked.status).toBe(403);

    const deleteBlocked = await request(app)
      .delete(`/api/teams/${created.body.id}`)
      .set('Authorization', `Bearer ${regular.token}`);
    expect(deleteBlocked.status).toBe(403);
  });

  it('404s when updating or deleting a team that does not exist', async () => {
    const updateRes = await request(app)
      .put('/api/teams/not-a-real-id')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'X' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete('/api/teams/not-a-real-id')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteRes.status).toBe(404);
  });

  it('clears a user\'s team_id (rather than deleting the user) when their team is deleted', async () => {
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Team To Delete' });

    const user = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ username: 'team-delete-user', password: 'password123', team_id: team.body.id });
    expect(user.body.team_id).toBe(team.body.id);

    await request(app).delete(`/api/teams/${team.body.id}`).set('Authorization', `Bearer ${admin.token}`);

    const listed = await request(app).get('/api/users').set('Authorization', `Bearer ${admin.token}`);
    const found = listed.body.find(u => u.id === user.body.id);
    expect(found.team_id).toBeNull();

    await request(app).delete(`/api/users/${user.body.id}`).set('Authorization', `Bearer ${admin.token}`);
  });
});
