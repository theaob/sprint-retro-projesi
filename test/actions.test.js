import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser, createRetro } from './helpers.js';

// Action items are a Scrum Master (retro owner) / admin responsibility — everyone
// else, including anonymous guests, gets a read-only view. See routes.js.
describe('action items — Scrum Master gating', () => {
  let admin, owner, outsider, retro, entryId;

  beforeAll(async () => {
    admin = await loginAdmin();
    owner = await registerUser('actions-owner');
    outsider = await registerUser('actions-outsider');
    retro = await createRetro(owner, 'Actions Test Retro');
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    const columnId = fetched.body.columns[0].id;
    const entry = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Something to act on' });
    entryId = entry.body.id;
  });

  it('blocks an anonymous guest from adding an action item', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .send({ content: 'Fix the pipeline' });
    expect(res.status).toBe(401);
  });

  it('blocks an authenticated non-owner, non-admin from adding an action item', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ content: 'Fix the pipeline' });
    expect(res.status).toBe(403);
  });

  it('lets the retro owner (Scrum Master) add an action item', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Fix the pipeline', assignee: 'dev-team' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Fix the pipeline');
  });

  it('lets an admin add and remove an action item even without owning the retro', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ content: 'Admin-added action' });
    expect(added.status).toBe(201);

    const removed = await request(app)
      .delete(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(removed.status).toBe(200);
  });

  it('blocks a non-owner from deleting an action item, but allows the owner', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Owner-added action' });

    const blocked = await request(app)
      .delete(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(allowed.status).toBe(200);
  });
});
