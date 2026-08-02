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

  it('creates an action item with a due date and defaults to not done', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Ship the fix', due_date: '2026-12-31' });
    expect(res.status).toBe(201);
    expect(res.body.due_date).toBe('2026-12-31');
    expect(res.body.done).toBe(0);
  });

  it('blocks a non-owner, non-admin from marking an action item done', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Update the runbook' });

    const res = await request(app)
      .put(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ done: true });
    expect(res.status).toBe(403);
  });

  it('lets the owner mark an action item done and change its due date independently', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Rotate the credentials', due_date: '2026-01-01' });

    const markedDone = await request(app)
      .put(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ done: true });
    expect(markedDone.status).toBe(200);
    expect(markedDone.body.done).toBe(1);
    expect(markedDone.body.due_date).toBe('2026-01-01'); // unaffected by the done-only update

    const dueDateChanged = await request(app)
      .put(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ due_date: '2026-02-01' });
    expect(dueDateChanged.status).toBe(200);
    expect(dueDateChanged.body.done).toBe(1); // unaffected by the due-date-only update
    expect(dueDateChanged.body.due_date).toBe('2026-02-01');
  });

  it('rejects an update with neither done nor due_date', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/actions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Empty update test' });

    const res = await request(app)
      .put(`/api/retros/${retro.id}/actions/${added.body.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/action-items/open', () => {
  let owner, otherOwner, admin;

  beforeAll(async () => {
    admin = await loginAdmin();
    owner = await registerUser('open-actions-owner');
    otherOwner = await registerUser('open-actions-other-owner');
  });

  async function addAction(session, retro, content, done = false) {
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    const entry = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: fetched.body.columns[0].id, text: `entry for ${content}` });
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entry.body.id}/actions`)
      .set('Authorization', `Bearer ${session.token}`)
      .send({ content });
    if (done) {
      await request(app)
        .put(`/api/retros/${retro.id}/actions/${added.body.id}`)
        .set('Authorization', `Bearer ${session.token}`)
        .send({ done: true });
    }
    return added.body;
  }

  it('requires auth', async () => {
    const res = await request(app).get('/api/action-items/open');
    expect(res.status).toBe(401);
  });

  it('only returns not-done action items from retros the caller owns', async () => {
    const retro = await createRetro(owner, 'Open Actions Retro A');
    await addAction(owner, retro, 'Open item for owner');
    await addAction(owner, retro, 'Done item for owner', true);

    const otherRetro = await createRetro(otherOwner, 'Open Actions Retro B');
    await addAction(otherOwner, otherRetro, 'Open item for other owner');

    const res = await request(app).get('/api/action-items/open').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const contents = res.body.map(a => a.content);
    expect(contents).toContain('Open item for owner');
    expect(contents).not.toContain('Done item for owner');
    expect(contents).not.toContain('Open item for other owner');
  });

  it('includes retro_title for context', async () => {
    const retro = await createRetro(owner, 'Titled Retro For Actions');
    await addAction(owner, retro, 'Item with a titled retro');

    const res = await request(app).get('/api/action-items/open').set('Authorization', `Bearer ${owner.token}`);
    const item = res.body.find(a => a.content === 'Item with a titled retro');
    expect(item.retro_title).toBe('Titled Retro For Actions');
  });

  it('shows an admin open items across every retro, not just their own', async () => {
    const res = await request(app).get('/api/action-items/open').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const contents = res.body.map(a => a.content);
    expect(contents).toContain('Open item for owner');
    expect(contents).toContain('Open item for other owner');
  });

  it('annotates each item with the retro creator\'s team, null when unset', async () => {
    // owner/otherOwner were registered without a team — self-registration
    // doesn't accept one, only an admin assigning it after the fact.
    await request(app)
      .put(`/api/users/${owner.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ team: 'Takım A' });

    const retro = await createRetro(owner, 'Team-tagged Retro');
    await addAction(owner, retro, 'Item for a team-tagged retro');

    const otherRetro = await createRetro(otherOwner, 'Teamless Retro');
    await addAction(otherOwner, otherRetro, 'Item for a teamless retro');

    const res = await request(app).get('/api/action-items/open').set('Authorization', `Bearer ${admin.token}`);
    const tagged = res.body.find(a => a.content === 'Item for a team-tagged retro');
    const untagged = res.body.find(a => a.content === 'Item for a teamless retro');
    expect(tagged.team).toBe('Takım A');
    expect(untagged.team).toBeNull();
  });
});
