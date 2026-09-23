import { WebSocketServer } from 'ws';
import db from './db.js';

// Every legitimate client message (join / typing) is a few hundred bytes —
// ws's own default cap is 100 MiB, which just hands out free memory.
const MAX_PAYLOAD_BYTES = 4096;

// Per-connection message budget. The client throttles typing to one message
// per 2s, so this only ever trips for a script flooding the room.
const RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 30;

const HEARTBEAT_MS = 30_000;

/**
 * Attaches the retro WebSocket server (path /ws) to an HTTP server and
 * returns its `broadcast(retroId, payload, excludeWs?)` function plus the
 * underlying pieces (for tests and shutdown).
 */
export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_PAYLOAD_BYTES });

  // rooms: Map<retroId, Set<WebSocket>>
  const rooms = new Map();
  const retroExists = db.prepare('SELECT 1 FROM retros WHERE id = ?');

  /**
   * Broadcast a message to all WebSocket clients in the given retro room.
   * Pass excludeWs (e.g. the sender) to skip one connection — used for
   * typing indicators, where you don't need to see your own.
   */
  function broadcast(retroId, payload, excludeWs = null) {
    const room = rooms.get(retroId);
    if (!room) return;
    const data = JSON.stringify(payload);
    for (const client of room) {
      if (client !== excludeWs && client.readyState === 1 /* OPEN */) {
        client.send(data);
      }
    }
  }

  function broadcastPresence(retroId) {
    const room = rooms.get(retroId);
    const users = room ? Array.from(room).map((client) => client.presenceName || null) : [];
    broadcast(retroId, { type: 'presence:update', users });
  }

  // Removes a socket from its room, dropping the room entirely once it's
  // empty so the map can't grow without bound.
  function leaveRoom(ws, retroId) {
    const room = rooms.get(retroId);
    if (!room) return;
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(retroId);
    } else {
      broadcastPresence(retroId);
    }
  }

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    // Protocol errors (e.g. a frame over maxPayload) are emitted here before
    // ws closes the socket itself; without a listener they'd be thrown as an
    // unhandled 'error' event and take the whole process down.
    ws.on('error', () => {});
    let currentRoom = null;
    let windowStart = Date.now();
    let messagesInWindow = 0;
    ws.presenceName = null;

    ws.on('message', (raw) => {
      const now = Date.now();
      if (now - windowStart > RATE_WINDOW_MS) {
        windowStart = now;
        messagesInWindow = 0;
      }
      if (++messagesInWindow > MAX_MESSAGES_PER_WINDOW) {
        ws.close(1008, 'rate limit');
        return;
      }

      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'join' && typeof msg.retroId === 'string' && msg.retroId) {
          // Only real retros get a room — otherwise any string would mint one
          if (!retroExists.get(msg.retroId)) return;

          if (currentRoom) leaveRoom(ws, currentRoom);
          currentRoom = msg.retroId;
          ws.presenceName = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 40) : null;
          if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
          rooms.get(currentRoom).add(ws);
          broadcastPresence(currentRoom);
        } else if (msg.type === 'typing' && currentRoom && typeof msg.columnId === 'string' && msg.columnId) {
          // Relayed only to the rest of the room — the client throttles how
          // often it sends these, the server just passes them through.
          broadcast(currentRoom, { type: 'typing', columnId: msg.columnId.slice(0, 64), name: ws.presenceName || 'Misafir' }, ws);
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (currentRoom) leaveRoom(ws, currentRoom);
    });
  });

  // Heartbeat interval to check dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) { ws.terminate(); return; }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_MS);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return { wss, rooms, broadcast };
}
