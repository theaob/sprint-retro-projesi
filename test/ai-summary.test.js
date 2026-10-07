import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, registerUser } from './helpers.js';
import { setSummarizer, setBroadcast } from '../server/routes.js';
import { SummaryError } from '../server/ai.js';

const SUMMARY = {
  overview: 'A steady sprint slowed down by reviews.',
  themes: [{ title: 'Code review', detail: 'Reviews take more than two days.' }],
  went_well: ['Deploys are faster'],
  to_improve: ['Review turnaround'],
  action_items: ['Set a one-day review target']
};

describe('AI retro summary', () => {
  let owner, other, retro;
  const calls = [];
  const sent = [];
  const asOwner = (req) => req.set('Authorization', `Bearer ${owner.token}`);
  const summarize = (as = asOwner) => as(request(app).post(`/api/retros/${retro.id}/summary`));

  beforeAll(async () => {
    // A stand-in for Claude, so the suite never calls the real API
    setSummarizer(async (r, columns) => { calls.push({ r, columns }); return SUMMARY; });
    setBroadcast((_id, payload) => sent.push(payload));
    owner = await registerUser('summary-owner');
    other = await registerUser('summary-other');
    retro = (await asOwner(request(app).post('/api/retros')).send({ title: 'Sprint 9', columns: ['Good', 'Bad'] })).body;
    const board = (await request(app).get(`/api/retros/${retro.id}`)).body;
    const [good, bad] = board.columns.map(c => c.id);
    const add = (column_id, text) => request(app).post(`/api/retros/${retro.id}/entries`).send({ column_id, text, participant_id: 'p1' });
    const deploy = (await add(good, 'Deploys are faster')).body;
    await add(bad, 'Reviews take two days');
    await request(app).post(`/api/retros/${retro.id}/entries/${deploy.id}/vote`).send({ participant_id: 'p2' });
  });

  afterAll(() => {
    setSummarizer(null);
    setBroadcast(() => {});
  });

  it('tells the board whether summaries are available', async () => {
    const res = await request(app).get(`/api/retros/${retro.id}`);
    expect(res.body.ai_summary_available).toBe(true);
    expect(res.body.ai_summary).toBeNull();
  });

  it('only summarizes a finished retro', async () => {
    expect((await summarize()).status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  it('is limited to the facilitator', async () => {
    await asOwner(request(app).put(`/api/retros/${retro.id}/status`)).send({ status: 'finished' });
    expect((await request(app).post(`/api/retros/${retro.id}/summary`)).status).toBe(401);
    const asOther = (req) => req.set('Authorization', `Bearer ${other.token}`);
    expect((await summarize(asOther)).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('sends the notes with their votes, then stores and broadcasts the summary', async () => {
    const res = await summarize();
    expect(res.status).toBe(200);
    expect(res.body.ai_summary).toEqual(SUMMARY);

    const [{ columns }] = calls;
    expect(columns.map(c => c.name)).toEqual(['Good', 'Bad']);
    expect(columns[0].entries).toEqual([expect.objectContaining({ text: 'Deploys are faster', votes: 1 })]);
    // Only text and votes go out: no participant ids
    expect(columns[0].entries[0]).not.toHaveProperty('participant_id');

    expect(sent).toContainEqual(expect.objectContaining({ type: 'retro:summary', summary: SUMMARY }));
    const board = await request(app).get(`/api/retros/${retro.id}`);
    expect(board.body.ai_summary).toEqual(SUMMARY);
    expect(board.body.ai_summary_at).toBeTruthy();
  });

  it('passes on a failure with its message, keeping the previous summary', async () => {
    setSummarizer(async () => { throw new SummaryError('The AI service is busy. Try again in a minute.', 429); });
    const res = await summarize();
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/busy/);
    expect((await request(app).get(`/api/retros/${retro.id}`)).body.ai_summary).toEqual(SUMMARY);
  });

  it('refuses a retro with no notes', async () => {
    setSummarizer(async () => SUMMARY);
    const empty = (await asOwner(request(app).post('/api/retros')).send({ title: 'Empty', columns: ['A'] })).body;
    await asOwner(request(app).put(`/api/retros/${empty.id}/status`)).send({ status: 'finished' });
    expect((await asOwner(request(app).post(`/api/retros/${empty.id}/summary`))).status).toBe(400);
  });

  it('is off without an API key', async () => {
    setSummarizer(async () => SUMMARY, () => false);
    expect((await summarize()).status).toBe(503);
    expect((await request(app).get(`/api/retros/${retro.id}`)).body.ai_summary_available).toBe(false);
  });
});
