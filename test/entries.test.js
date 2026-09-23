import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, registerUser, createRetro } from './helpers.js';
import db from '../server/db.js';

describe('entries', () => {
  let owner, outsider, retro, columnId, secondColumnId;

  beforeAll(async () => {
    owner = await registerUser('entries-owner');
    outsider = await registerUser('entries-outsider');
    retro = await createRetro(owner, 'Entries Test Retro');
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    columnId = fetched.body.columns[0].id;
    secondColumnId = fetched.body.columns[1].id;
  });

  it('lets a guest (no auth) add an entry', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Deploys are flaky' });
    expect(res.status).toBe(201);
    expect(res.body.votes).toBe(0);
  });

  it('requires a participant_id to vote when not authenticated', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Standups run long' });
    const res = await request(app).post(`/api/retros/${retro.id}/entries/${added.body.id}/vote`);
    expect(res.status).toBe(400);
  });

  it('lets a guest vote and unvote via a persistent participant_id', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Deploys take too long' });
    const entryId = added.body.id;
    const participantId = 'guest-participant-1';

    const vote = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/vote`)
      .send({ participant_id: participantId });
    expect(vote.status).toBe(200);
    expect(vote.body.votes).toBe(1);

    const unvote = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/unvote`)
      .send({ participant_id: participantId });
    expect(unvote.status).toBe(200);
    expect(unvote.body.votes).toBe(0);
  });

  it('rejects voting for the same entry twice from the same participant', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Double-vote test' });
    const entryId = added.body.id;
    const participantId = 'guest-participant-2';

    await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/vote`).send({ participant_id: participantId });
    const second = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entryId}/vote`)
      .send({ participant_id: participantId });
    expect(second.status).toBe(409);
  });

  it('enforces max_votes per participant across the whole retro', async () => {
    const limited = await createRetro(owner, 'Vote Limit Retro', ['Only Column']);
    const fetched = await request(app).get(`/api/retros/${limited.id}`);
    const colId = fetched.body.columns[0].id;
    const participantId = 'guest-participant-3';

    // retro's max_votes defaults to 3 via createRetro's helper
    const entryIds = [];
    for (let i = 0; i < 4; i++) {
      const added = await request(app)
        .post(`/api/retros/${limited.id}/entries`)
        .send({ column_id: colId, text: `Entry ${i}` });
      entryIds.push(added.body.id);
    }

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post(`/api/retros/${limited.id}/entries/${entryIds[i]}/vote`)
        .send({ participant_id: participantId });
      expect(res.status).toBe(200);
    }

    const fourth = await request(app)
      .post(`/api/retros/${limited.id}/entries/${entryIds[3]}/vote`)
      .send({ participant_id: participantId });
    expect(fourth.status).toBe(400);
  });

  it('reports voted_entry_ids for the requesting participant on GET', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Voted-entries reporting test' });
    const entryId = added.body.id;
    const participantId = 'guest-participant-4';

    await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/vote`).send({ participant_id: participantId });

    const withId = await request(app).get(`/api/retros/${retro.id}?participant_id=${participantId}`);
    expect(withId.body.voted_entry_ids).toContain(entryId);

    const withoutId = await request(app).get(`/api/retros/${retro.id}`);
    expect(withoutId.body.voted_entry_ids).toEqual([]);
  });

  it('lets an authenticated user vote using their own identity, no participant_id needed', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Logged-in voter test' });
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries/${added.body.id}/vote`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(200);
    expect(res.body.votes).toBe(1);
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

  it('requires auth to move an entry between columns', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Move me (no auth)' });
    const res = await request(app)
      .put(`/api/retros/${retro.id}/entries/${added.body.id}/move`)
      .send({ column_id: secondColumnId });
    expect(res.status).toBe(401);
  });

  it('blocks a non-owner, non-admin from moving an entry', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Move me (outsider)' });
    const res = await request(app)
      .put(`/api/retros/${retro.id}/entries/${added.body.id}/move`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ column_id: secondColumnId });
    expect(res.status).toBe(403);
  });

  it('rejects moving an entry to a column from a different retro', async () => {
    const otherRetro = await createRetro(owner, 'Other Retro');
    const otherFetched = await request(app).get(`/api/retros/${otherRetro.id}`);
    const foreignColumnId = otherFetched.body.columns[0].id;

    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Move me (cross-retro)' });
    const res = await request(app)
      .put(`/api/retros/${retro.id}/entries/${added.body.id}/move`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ column_id: foreignColumnId });
    expect(res.status).toBe(400);
  });

  it('lets the owner move an entry to a different column in the same retro', async () => {
    const added = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Move me (owner)' });
    const res = await request(app)
      .put(`/api/retros/${retro.id}/entries/${added.body.id}/move`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ column_id: secondColumnId });
    expect(res.status).toBe(200);
    expect(res.body.column_id).toBe(secondColumnId);
  });
});

describe('vote identity', () => {
  it('hides the owner id from the public board and reports is_owner instead', async () => {
    const owner = await registerUser('identity-owner');
    const retro = await createRetro(owner, 'Identity Retro');

    const guestView = await request(app).get(`/api/retros/${retro.id}`);
    expect(guestView.body.created_by).toBeUndefined();
    expect(guestView.body.is_owner).toBe(false);

    const ownerView = await request(app).get(`/api/retros/${retro.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(ownerView.body.is_owner).toBe(true);
  });

  it("stops a guest from reading or withdrawing a user's votes by sending their id", async () => {
    const owner = await registerUser('identity-owner-2');
    const retro = await createRetro(owner, 'Impersonation Retro');
    const board = await request(app).get(`/api/retros/${retro.id}`);
    const entry = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: board.body.columns[0].id, text: 'Owner likes this' });

    await request(app)
      .post(`/api/retros/${retro.id}/entries/${entry.body.id}/vote`)
      .set('Authorization', `Bearer ${owner.token}`);

    const peek = await request(app).get(`/api/retros/${retro.id}?participant_id=${owner.user.id}`);
    expect(peek.body.voted_entry_ids).toEqual([]);

    const unvote = await request(app)
      .post(`/api/retros/${retro.id}/entries/${entry.body.id}/unvote`)
      .send({ participant_id: owner.user.id });
    expect(unvote.status).toBe(404);

    const ownerView = await request(app).get(`/api/retros/${retro.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(ownerView.body.voted_entry_ids).toEqual([entry.body.id]);
    expect(ownerView.body.columns[0].entries[0].votes).toBe(1);
  });

  it('stores guest votes under the anon: namespace', async () => {
    const owner = await registerUser('identity-owner-3');
    const retro = await createRetro(owner, 'Namespace Retro');
    const board = await request(app).get(`/api/retros/${retro.id}`);
    const entry = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: board.body.columns[0].id, text: 'Guest vote' });

    await request(app).post(`/api/retros/${retro.id}/entries/${entry.body.id}/vote`).send({ participant_id: 'guest-ns' });
    const row = db.prepare('SELECT participant_id FROM votes WHERE entry_id = ?').get(entry.body.id);
    expect(row.participant_id).toBe('anon:guest-ns');
  });
});

describe('finished retros', () => {
  let owner, retro, columnId, entryId;

  beforeAll(async () => {
    owner = await registerUser('finished-owner');
    retro = await createRetro(owner, 'Finished Retro');
    const board = await request(app).get(`/api/retros/${retro.id}`);
    columnId = board.body.columns[0].id;
    const entry = await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: columnId, text: 'Before finish' });
    entryId = entry.body.id;
    await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/vote`).send({ participant_id: 'finished-guest' });
    await request(app)
      .put(`/api/retros/${retro.id}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'finished' });
  });

  it('rejects new entries once the retro is finished', async () => {
    const res = await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: columnId, text: 'Too late' });
    expect(res.status).toBe(409);
  });

  it('rejects votes and unvotes once the retro is finished', async () => {
    const vote = await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/vote`).send({ participant_id: 'late-guest' });
    expect(vote.status).toBe(409);
    const unvote = await request(app).post(`/api/retros/${retro.id}/entries/${entryId}/unvote`).send({ participant_id: 'finished-guest' });
    expect(unvote.status).toBe(409);
  });

  it('accepts changes again after the retro is reopened', async () => {
    await request(app)
      .put(`/api/retros/${retro.id}/status`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'active' });
    const res = await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: columnId, text: 'Reopened' });
    expect(res.status).toBe(201);
  });

  it("rejects an entry whose column belongs to a different retro", async () => {
    const otherRetro = await createRetro(owner, 'Other Retro');
    const otherBoard = await request(app).get(`/api/retros/${otherRetro.id}`);
    const res = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: otherBoard.body.columns[0].id, text: 'Wrong board' });
    expect(res.status).toBe(400);
  });

  it('404s when adding an entry to a retro that does not exist', async () => {
    const res = await request(app).post('/api/retros/no-such-retro/entries').send({ column_id: columnId, text: 'x' });
    expect(res.status).toBe(404);
  });
});
