import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import { setBroadcast } from './routes.js';

const PORT = process.env.PORT || 3000;

// ── HTTP + WebSocket Server ─────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// rooms: Map<retroId, Set<WebSocket>>
const rooms = new Map();

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

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let currentRoom = null;
  ws.presenceName = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'join' && msg.retroId) {
        // Leave previous room
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).delete(ws);
          broadcastPresence(currentRoom);
        }
        // Join new room
        currentRoom = msg.retroId;
        ws.presenceName = typeof msg.name === 'string' && msg.name.trim() ? msg.name.trim().slice(0, 40) : null;
        if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
        rooms.get(currentRoom).add(ws);
        broadcastPresence(currentRoom);
      } else if (msg.type === 'typing' && currentRoom && msg.columnId) {
        // Relayed only to the rest of the room — the client throttles how
        // often it sends these, the server just passes them through.
        broadcast(currentRoom, { type: 'typing', columnId: msg.columnId, name: ws.presenceName || 'Misafir' }, ws);
      }
    } catch (e) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      broadcastPresence(currentRoom);
    }
  });
});

// Heartbeat interval to check dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

setBroadcast(broadcast);

server.listen(PORT, () => {
  console.log(`🚀 Sprint Retro server running on http://localhost:${PORT}`);
});
