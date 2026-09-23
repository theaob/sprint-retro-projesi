import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import WebSocket from 'ws';
import { app, registerUser, createRetro } from './helpers.js';
import { attachRealtime } from '../server/realtime.js';

describe('realtime (WebSocket)', () => {
  let server, realtime, url, retro;

  beforeAll(async () => {
    server = http.createServer(app);
    realtime = attachRealtime(server);
    await new Promise((resolve) => server.listen(0, resolve));
    url = `ws://localhost:${server.address().port}/ws`;

    const owner = await registerUser('realtime-owner');
    retro = await createRetro(owner, 'Realtime Retro');
  });

  afterAll(async () => {
    for (const ws of realtime.wss.clients) ws.terminate();
    await new Promise((resolve) => realtime.wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  function connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  const nextMessage = (ws) => new Promise((resolve) => ws.once('message', (data) => resolve(JSON.parse(data))));
  const closed = (ws) => new Promise((resolve) => ws.once('close', (code) => resolve(code)));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('joins a real retro room and receives presence', async () => {
    const ws = await connect();
    const presence = nextMessage(ws);
    ws.send(JSON.stringify({ type: 'join', retroId: retro.id, name: 'Ayşe' }));
    expect(await presence).toEqual({ type: 'presence:update', users: ['Ayşe'] });
    expect(realtime.rooms.get(retro.id).size).toBe(1);

    ws.close();
    await closed(ws);
    await settle();
  });

  it('relays typing without saying who is typing', async () => {
    const typer = await connect();
    const watcher = await connect();
    typer.send(JSON.stringify({ type: 'join', retroId: retro.id, name: 'Ayşe' }));
    await nextMessage(typer);
    const joined = nextMessage(watcher);
    watcher.send(JSON.stringify({ type: 'join', retroId: retro.id, name: 'Mehmet' }));
    await joined;

    const typing = nextMessage(watcher);
    typer.send(JSON.stringify({ type: 'typing', columnId: 'col-1', name: 'Ayşe' }));
    expect(await typing).toEqual({ type: 'typing', columnId: 'col-1' });

    typer.close();
    watcher.close();
    await Promise.all([closed(typer), closed(watcher)]);
    await settle();
  });

  it('drops a room once its last client leaves', async () => {
    const ws = await connect();
    ws.send(JSON.stringify({ type: 'join', retroId: retro.id }));
    await nextMessage(ws);
    ws.close();
    await closed(ws);
    await settle();
    expect(realtime.rooms.has(retro.id)).toBe(false);
  });

  it('does not create rooms for retro ids that do not exist', async () => {
    const ws = await connect();
    for (let i = 0; i < 5; i++) ws.send(JSON.stringify({ type: 'join', retroId: `bogus-${i}` }));
    await settle();
    expect([...realtime.rooms.keys()].some((id) => id.startsWith('bogus-'))).toBe(false);
    ws.close();
    await closed(ws);
  });

  it('closes a connection that sends an oversized message', async () => {
    const ws = await connect();
    const code = closed(ws);
    ws.send('x'.repeat(10_000));
    expect(await code).toBe(1009); // Message Too Big
  });

  it('closes a connection that floods messages', async () => {
    const ws = await connect();
    const code = closed(ws);
    for (let i = 0; i < 40; i++) ws.send(JSON.stringify({ type: 'typing', columnId: 'c' }));
    expect(await code).toBe(1008); // Policy Violation
  });
});
