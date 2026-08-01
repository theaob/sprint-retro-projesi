import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser, createRetro } from './helpers.js';

describe('retros', () => {
  let admin, owner, outsider;

  beforeAll(async () => {
    admin = await loginAdmin();
    owner = await registerUser('retro-owner');
    outsider = await registerUser('retro-outsider');
  });

  it('requires auth to create a retro', async () => {
    const res = await request(app).post('/api/retros').send({ title: 'X', columns: ['A'] });
    expect(res.status).toBe(401);
  });

  it('creates a retro with columns and a short code', async () => {
    const retro = await createRetro(owner, 'Sprint 1 Retro', ['İyi Giden', 'Kötü Giden', 'Aksiyon']);
    expect(retro.id).toBeTruthy();
    expect(retro.short_code).toMatch(/^[a-z0-9]{6}$/);
  });

  it('serves a retro with its columns and entries with no auth required (public board)', async () => {
    const retro = await createRetro(owner, 'Public Board');
    const res = await request(app).get(`/api/retros/${retro.id}`);
    expect(res.status).toBe(200);
    expect(res.body.columns).toHaveLength(2);
    expect(res.body.columns[0].entries).toEqual([]);
  });

  it('404s for an unknown retro id', async () => {
    const res = await request(app).get('/api/retros/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('scopes the retro list to the owner, but shows everything to admins', async () => {
    await createRetro(owner, 'Owner Only Retro');
    const ownerList = await request(app).get('/api/retros').set('Authorization', `Bearer ${owner.token}`);
    expect(ownerList.body.every(r => r.created_by === owner.user.id)).toBe(true);

    const adminList = await request(app).get('/api/retros').set('Authorization', `Bearer ${admin.token}`);
    expect(adminList.body.length).toBeGreaterThanOrEqual(ownerList.body.length);
  });

  it('blocks a non-owner, non-admin from renaming a column', async () => {
    const retro = await createRetro(owner, 'Rename Test');
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    const colId = fetched.body.columns[0].id;
    const res = await request(app)
      .put(`/api/retros/${retro.id}/columns/${colId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('lets the owner change retro status to finished', async () => {
    const retro = await createRetro(owner, 'Finish Test');
    const res = await request(app)
      .put(`/api/retros/${retro.id}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'finished' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('finished');
  });

  it('blocks a non-owner, non-admin from deleting a retro, but allows the owner', async () => {
    const retro = await createRetro(owner, 'Delete Test');
    const blocked = await request(app)
      .delete(`/api/retros/${retro.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/retros/${retro.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(allowed.status).toBe(200);
  });
});
