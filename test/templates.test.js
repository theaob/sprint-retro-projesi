import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser } from './helpers.js';

describe('retro templates', () => {
  let admin, regular;

  beforeAll(async () => {
    admin = await loginAdmin();
    regular = await registerUser('templates-regular');
  });

  it('requires auth to list templates', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(401);
  });

  it('lets any authenticated user list templates, including the seeded defaults', async () => {
    const res = await request(app).get('/api/templates').set('Authorization', `Bearer ${regular.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
    const names = res.body.map(t => t.name);
    expect(names).toContain('Standart');
    expect(names).toContain('Mad/Sad/Glad');
    // columns should already be parsed back into a real array, not a JSON string
    const standard = res.body.find(t => t.name === 'Standart');
    expect(Array.isArray(standard.columns)).toBe(true);
    expect(standard.columns).toContain('İyi Giden');
  });

  it('blocks a non-admin from creating a template', async () => {
    const res = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ name: 'Sneaky', columns: ['A', 'B'] });
    expect(res.status).toBe(403);
  });

  it('rejects a template with no columns or a blank name', async () => {
    const noColumns = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Empty', columns: [] });
    expect(noColumns.status).toBe(400);

    const blankName = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: '  ', columns: ['A'] });
    expect(blankName.status).toBe(400);
  });

  it('lets an admin create, update, and delete a template', async () => {
    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Custom Template', columns: ['One', 'Two'] });
    expect(created.status).toBe(201);
    expect(created.body.columns).toEqual(['One', 'Two']);

    const updated = await request(app)
      .put(`/api/templates/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Renamed Template', columns: ['One', 'Two', 'Three'] });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed Template');
    expect(updated.body.columns).toEqual(['One', 'Two', 'Three']);

    const listed = await request(app).get('/api/templates').set('Authorization', `Bearer ${regular.token}`);
    expect(listed.body.map(t => t.name)).toContain('Renamed Template');

    const deleted = await request(app)
      .delete(`/api/templates/${created.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleted.status).toBe(200);

    const afterDelete = await request(app).get('/api/templates').set('Authorization', `Bearer ${regular.token}`);
    expect(afterDelete.body.map(t => t.name)).not.toContain('Renamed Template');
  });

  it('blocks a non-admin from updating or deleting a template', async () => {
    const created = await request(app)
      .post('/api/templates')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'Protected Template', columns: ['A'] });

    const updateBlocked = await request(app)
      .put(`/api/templates/${created.body.id}`)
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ name: 'Hacked', columns: ['A'] });
    expect(updateBlocked.status).toBe(403);

    const deleteBlocked = await request(app)
      .delete(`/api/templates/${created.body.id}`)
      .set('Authorization', `Bearer ${regular.token}`);
    expect(deleteBlocked.status).toBe(403);
  });

  it('404s when updating or deleting a template that does not exist', async () => {
    const updateRes = await request(app)
      .put('/api/templates/not-a-real-id')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ name: 'X', columns: ['A'] });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete('/api/templates/not-a-real-id')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteRes.status).toBe(404);
  });

});
