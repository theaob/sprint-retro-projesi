import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, registerUser, createRetro } from './helpers.js';

describe('column CRUD', () => {
  let owner, outsider, retro;

  beforeAll(async () => {
    owner = await registerUser('columns-owner');
    outsider = await registerUser('columns-outsider');
    retro = await createRetro(owner, 'Columns Test Retro', ['A', 'B']);
  });

  it('requires auth to add a column', async () => {
    const res = await request(app).post(`/api/retros/${retro.id}/columns`).send({ name: 'C' });
    expect(res.status).toBe(401);
  });

  it('blocks a non-owner, non-admin from adding a column', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/columns`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'C' });
    expect(res.status).toBe(403);
  });

  it('lets the owner add a column, appended at the end', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/columns`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'C' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('C');
    expect(res.body.entries).toEqual([]);

    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    expect(fetched.body.columns.map(c => c.name)).toEqual(['A', 'B', 'C']);
  });

  it('rejects an empty column name', async () => {
    const res = await request(app)
      .post(`/api/retros/${retro.id}/columns`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('blocks a non-owner, non-admin from deleting a column', async () => {
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    const colId = fetched.body.columns[2].id; // 'C'
    const res = await request(app)
      .delete(`/api/retros/${retro.id}/columns/${colId}`)
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(403);
  });

  it('lets the owner delete a column', async () => {
    const fetched = await request(app).get(`/api/retros/${retro.id}`);
    const colId = fetched.body.columns.find(c => c.name === 'C').id;
    const res = await request(app)
      .delete(`/api/retros/${retro.id}/columns/${colId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const after = await request(app).get(`/api/retros/${retro.id}`);
    expect(after.body.columns.map(c => c.name)).toEqual(['A', 'B']);
  });

  it('refuses to delete the last remaining column', async () => {
    const single = await createRetro(owner, 'Single Column Retro', ['Only']);
    const fetched = await request(app).get(`/api/retros/${single.id}`);
    const colId = fetched.body.columns[0].id;
    const res = await request(app)
      .delete(`/api/retros/${single.id}/columns/${colId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(400);
  });

  it('a literal colId of "reorder" 404s cleanly now that the reorder route is gone', async () => {
    // Regression guard for the inverse of the bug this route ordering used
    // to protect against: with the reorder endpoint removed, a request to
    // .../columns/reorder now falls through to the rename route's :colId
    // wildcard and should 404 (no column literally named "reorder"), not
    // silently succeed or throw.
    const res = await request(app)
      .put(`/api/retros/${retro.id}/columns/reorder`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Should 404' });
    expect(res.status).toBe(404);
  });
});
