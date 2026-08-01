import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, registerUser, createRetro } from './helpers.js';

describe('entries', () => {
  let owner, outsider, retro, columnId;

  beforeAll(async () => {
    owner = await registerUser('entries-owner');
    outsider = await registerUser('entries-outsider');
    retro = await createRetro(owner, 'Entries Test Retro');
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    columnId = fetched.body.columns[0].id;
  });

  it('lets a guest (no auth) add an entry', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Deploys are flaky' });
    expect(res.status).toBe(201);
    expect(res.body.votes).toBe(0);
  });

  it('lets a guest vote and unvote with no server-side limit today (tracked for v4.1)', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Standups run long' });
    const entryId = added.body.id;

    await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/vote`);
    const vote2 = await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/vote`);
    // No participant identity exists server-side yet, so nothing stops the same
    // caller voting past max_votes — this is the gap v4.1 closes.
    expect(vote2.body.votes).toBe(2);

    const unvote = await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/unvote`);
    expect(unvote.body.votes).toBe(1);
  });

  it('blocks a non-owner, non-admin from editing or deleting an entry', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Original text' });
    const entryId = added.body.id;

    const editBlocked = await request(app)
      .put(`/api/retros/${retro.id}/entries/${entryId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ text: 'Hacked' });
    expect(editBlocked.status).toBe(403);

    const deleteBlocked = await request(app)
      .delete(`/api/retros/${retro.id}/entries/${entryId}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(deleteBlocked.status).toBe(403);
  });

  it('lets the owner edit and delete an entry', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Will be edited' });
    const entryId = added.body.id;

    const edit = await request(app)
      .put(`/api/retros/${retro.id}/entries/${entryId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ text: 'Edited text' });
    expect(edit.status).toBe(200);
    expect(edit.body.text).toBe('Edited text');

    const del = await request(app)
      .delete(`/api/retros/${retro.id}/entries/${entryId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(del.status).toBe(200);
  });
});
