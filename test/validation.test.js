import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAdmin, registerUser, createRetro } from './helpers.js';

describe('input validation', () => {
  let admin, owner, retro, columnId;

  beforeAll(async () => {
    admin = await loginAdmin();
    owner = await registerUser('validation-owner');
    retro = await createRetro(owner, 'Validation Retro');
    const board = await request(app).get(`/api/retros/${retro.id}`);
    columnId = board.body.columns[0].id;
  });

  const asAdmin = (req) => req.set('Authorization', `Bearer ${admin.token}`);
  const asOwner = (req) => req.set('Authorization', `Bearer ${owner.token}`);

  it('answers malformed JSON with a JSON 400, not an HTML error page', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it('rejects non-string credentials on register instead of crashing', async () => {
    const numericPassword = await request(app).post('/api/auth/register').send({ username: 'typed-user', password: 1234567 });
    expect(numericPassword.status).toBe(400);
    const objectUsername = await request(app).post('/api/auth/register').send({ username: { a: 1 }, password: 'password123' });
    expect(objectUsername.status).toBe(400);
  });

  it('trims usernames on register, so " name" collides with "name"', async () => {
    await registerUser('trim-target');
    const res = await request(app).post('/api/auth/register').send({ username: '  trim-target ', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('validates username edits: type, blank, and trimmed uniqueness', async () => {
    const target = await registerUser('edit-target');
    await registerUser('edit-taken');
    const edit = (body) => asAdmin(request(app).put(`/api/users/${target.user.id}`)).send(body);

    expect((await edit({ username: 5 })).status).toBe(400);
    expect((await edit({ username: '   ' })).status).toBe(400);
    expect((await edit({ username: ' edit-taken' })).status).toBe(409);
    expect((await edit({ email: 42 })).status).toBe(400);

    const ok = await edit({ username: ' edit-renamed ', email: ' a@b.co ' });
    expect(ok.status).toBe(200);
    expect(ok.body.username).toBe('edit-renamed');
    expect(ok.body.email).toBe('a@b.co');
  });

  it('only accepts known retro statuses', async () => {
    const res = await asOwner(request(app).put(`/api/retros/${retro.id}/status`)).send({ status: 'lol' });
    expect(res.status).toBe(400);
  });

  it('caps entry length and ignores a client-supplied author', async () => {
    const tooLong = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'a'.repeat(1001) });
    expect(tooLong.status).toBe(400);

    const spoofed = await request(app)
      .post(`/api/retros/${retro.id}/entries`)
      .send({ column_id: columnId, text: 'Signed by the boss', author: 'The Boss' });
    expect(spoofed.status).toBe(201);
    expect(spoofed.body.author).toBe('Anonim');
  });

  it('validates retro creation: title, column names, and max_votes range', async () => {
    const create = (body) => asOwner(request(app).post('/api/retros')).send(body);
    expect((await create({ title: 'x'.repeat(201), columns: ['a'] })).status).toBe(400);
    expect((await create({ title: 'ok', columns: [123] })).status).toBe(400);
    expect((await create({ title: 'ok', columns: ['a'], max_votes: 50 })).status).toBe(400);
    expect((await create({ title: 'ok', columns: ['a'], max_votes: 0 })).status).toBe(400);

    const ok = await create({ title: '  Trimmed  ', columns: [' Lane '] });
    expect(ok.status).toBe(201);
    const board = await request(app).get(`/api/retros/${ok.body.id}`);
    expect(board.body.title).toBe('Trimmed');
    expect(board.body.max_votes).toBe(3);
    expect(board.body.columns[0].name).toBe('Lane');
  });

  it('rejects template columns that are not strings instead of crashing', async () => {
    const res = await asAdmin(request(app).post('/api/templates')).send({ name: 'Bad', columns: ['ok', 7] });
    expect(res.status).toBe(400);
  });
});
