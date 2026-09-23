import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, registerUser } from './helpers.js';

describe('staged retros', () => {
  let owner, retro, columnId, noteA, noteB;

  const asOwner = (req) => req.set('Authorization', `Bearer ${owner.token}`);
  const setPhase = (phase) => asOwner(request(app).put(`/api/retros/${retro.id}/phase`)).send({ phase });
  const board = (participantId) => request(app).get(`/api/retros/${retro.id}?participant_id=${participantId}`);
  const addNote = (participantId, text) => request(app)
    .post(`/api/retros/${retro.id}/entries`)
    .send({ column_id: columnId, text, participant_id: participantId });
  const vote = (participantId, entryId) => request(app)
    .post(`/api/retros/${retro.id}/entries/${entryId}/vote`)
    .send({ participant_id: participantId });

  beforeAll(async () => {
    owner = await registerUser('stages-owner');
    const created = await asOwner(request(app).post('/api/retros')).send({ title: 'Staged', columns: ['İyi', 'Kötü'], staged: true });
    retro = created.body;
    columnId = (await board('x')).body.columns[0].id;
  });

  it('starts in setup, where notes cannot be added yet', async () => {
    expect(retro.phase).toBe('setup');
    const res = await addNote('alice', 'Too early');
    expect(res.status).toBe(409);
  });

  it('hides other people\'s notes while writing, but shows your own', async () => {
    expect((await setPhase('writing')).status).toBe(200);
    const a = await addNote('alice', 'Alice was here');
    const b = await addNote('bob', 'Bob was here');
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ text: 'Alice was here', mine: true, hidden: false });
    noteA = a.body.id;
    noteB = b.body.id;

    const aliceView = (await board('alice')).body.columns[0].entries;
    expect(aliceView.find(e => e.id === noteA)).toMatchObject({ text: 'Alice was here', mine: true });
    expect(aliceView.find(e => e.id === noteB)).toMatchObject({ text: '', hidden: true, mine: false });
    for (const e of aliceView) expect(e.participant_id).toBeUndefined();
  });

  it('does not let the facilitator read or edit hidden notes', async () => {
    const ownerView = (await asOwner(request(app).get(`/api/retros/${retro.id}`))).body.columns[0].entries;
    expect(ownerView.every(e => e.hidden)).toBe(true);
    const edit = await asOwner(request(app).put(`/api/retros/${retro.id}/entries/${noteA}`)).send({ text: 'peek' });
    expect(edit.status).toBe(409);
  });

  it('only allows votes during the voting stage', async () => {
    expect((await vote('carol', noteA)).status).toBe(409);
    await setPhase('voting');
    expect((await addNote('alice', 'Late note')).status).toBe(409);
    const res = await vote('carol', noteA);
    expect(res.status).toBe(200);
    expect(res.body.votes).toBeNull(); // counts stay hidden while voting
  });

  it('reveals notes but hides vote counts while voting', async () => {
    const res = await board('carol');
    const entries = res.body.columns[0].entries;
    expect(entries.find(e => e.id === noteB)).toMatchObject({ text: 'Bob was here', hidden: false, votes: null });
    expect(res.body.voted_entry_ids).toEqual([noteA]);
    expect(res.body.voter_count).toBe(1);
  });

  it('shows counts and focuses the top note when discussion starts', async () => {
    await vote('dave', noteA);
    const res = await setPhase('discussing');
    expect(res.body.focus_entry_id).toBe(noteA);
    const entries = (await board('carol')).body.columns[0].entries;
    expect(entries.find(e => e.id === noteA).votes).toBe(2);
    expect((await vote('erin', noteB)).status).toBe(409);
  });

  it('lets the facilitator move the focus and run a timer', async () => {
    expect((await asOwner(request(app).put(`/api/retros/${retro.id}/focus`)).send({ entry_id: noteB })).status).toBe(200);
    expect((await board('x')).body.focus_entry_id).toBe(noteB);

    const timer = await asOwner(request(app).put(`/api/retros/${retro.id}/timer`)).send({ seconds: 180 });
    expect(timer.status).toBe(200);
    const remaining = (new Date(timer.body.timer_ends_at) - Date.now()) / 1000;
    expect(remaining).toBeGreaterThan(170);
    expect(remaining).toBeLessThanOrEqual(180);

    const stop = await asOwner(request(app).put(`/api/retros/${retro.id}/timer`)).send({ seconds: 0 });
    expect(stop.body.timer_ends_at).toBeNull();
  });

  it('keeps stage, focus and timer controls to the facilitator', async () => {
    const outsider = await registerUser('stages-outsider');
    const as = (req) => req.set('Authorization', `Bearer ${outsider.token}`);
    expect((await as(request(app).put(`/api/retros/${retro.id}/phase`)).send({ phase: 'writing' })).status).toBe(403);
    expect((await as(request(app).put(`/api/retros/${retro.id}/focus`)).send({ entry_id: null })).status).toBe(403);
    expect((await as(request(app).put(`/api/retros/${retro.id}/timer`)).send({ seconds: 60 })).status).toBe(403);
    expect((await setPhase('bogus')).status).toBe(400);
  });

  it('shows everything once the retro is finished', async () => {
    await setPhase('writing');
    await asOwner(request(app).put(`/api/retros/${retro.id}/status`)).send({ status: 'finished' });
    const entries = (await board('nobody')).body.columns[0].entries;
    expect(entries.every(e => !e.hidden && typeof e.votes === 'number')).toBe(true);
  });
});

describe('simple retros keep working as before', () => {
  it('has no stage controls and shows notes and counts immediately', async () => {
    const owner = await registerUser('simple-owner');
    const asOwner = (req) => req.set('Authorization', `Bearer ${owner.token}`);
    const retro = (await asOwner(request(app).post('/api/retros')).send({ title: 'Simple', columns: ['A'] })).body;
    expect(retro.phase).toBeNull();
    expect((await asOwner(request(app).put(`/api/retros/${retro.id}/phase`)).send({ phase: 'voting' })).status).toBe(400);

    const col = (await request(app).get(`/api/retros/${retro.id}`)).body.columns[0].id;
    const note = await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: col, text: 'Visible', participant_id: 'p1' });
    const voted = await request(app).post(`/api/retros/${retro.id}/entries/${note.body.id}/vote`).send({ participant_id: 'p2' });
    expect(voted.body.votes).toBe(1);
    const other = (await request(app).get(`/api/retros/${retro.id}?participant_id=p2`)).body.columns[0].entries[0];
    expect(other).toMatchObject({ text: 'Visible', votes: 1, mine: false, hidden: false });
  });

  it('reports per-lane note counts on the retro list', async () => {
    const owner = await registerUser('list-owner');
    const asOwner = (req) => req.set('Authorization', `Bearer ${owner.token}`);
    const retro = (await asOwner(request(app).post('/api/retros')).send({ title: 'Counts', columns: ['A', 'B'] })).body;
    const cols = (await request(app).get(`/api/retros/${retro.id}`)).body.columns;
    await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: cols[1].id, text: 'One' });
    await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: cols[1].id, text: 'Two' });
    const listed = (await asOwner(request(app).get('/api/retros'))).body.find(r => r.id === retro.id);
    expect(listed.lane_counts).toEqual([0, 2]);
    expect(listed.entry_count).toBe(2);
  });
});

describe('live updates in a staged retro', () => {
  it('broadcasts placeholders while writing and vote progress (not counts) while voting', async () => {
    const { setBroadcast } = await import('../server/routes.js');
    const sent = [];
    setBroadcast((retroId, payload) => sent.push(payload));
    try {
      const owner = await registerUser('broadcast-owner');
      const asOwner = (req) => req.set('Authorization', `Bearer ${owner.token}`);
      const retro = (await asOwner(request(app).post('/api/retros')).send({ title: 'Live', columns: ['A'], staged: true })).body;
      const col = (await request(app).get(`/api/retros/${retro.id}`)).body.columns[0].id;
      await asOwner(request(app).put(`/api/retros/${retro.id}/phase`)).send({ phase: 'writing' });

      const note = await request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id: col, text: 'Secret', participant_id: 'w1' });
      const added = sent.find(m => m.type === 'entry:added');
      expect(added.entry).toMatchObject({ id: note.body.id, text: '', hidden: true });
      expect(JSON.stringify(sent)).not.toContain('Secret');

      await asOwner(request(app).put(`/api/retros/${retro.id}/phase`)).send({ phase: 'voting' });
      await request(app).post(`/api/retros/${retro.id}/entries/${note.body.id}/vote`).send({ participant_id: 'v1' });
      expect(sent.some(m => m.type === 'entry:voted')).toBe(false);
      expect(sent.find(m => m.type === 'vote:progress')).toEqual({ type: 'vote:progress', voters: 1 });
      expect(sent.find(m => m.type === 'retro:phase' && m.phase === 'voting')).toBeTruthy();
    } finally {
      setBroadcast(() => {});
    }
  });
});
