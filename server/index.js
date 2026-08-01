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

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  let currentRoom = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'join' && msg.retroId) {
        // Leave previous room
        if (currentRoom && rooms.has(currentRoom)) {
          rooms.get(currentRoom).delete(ws);
        }
        // Join new room
        currentRoom = msg.retroId;
        if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
        rooms.get(currentRoom).add(ws);
      }
    } catch (e) {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
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

/**
 * Broadcast a message to all WebSocket clients in the given retro room,
 * except the sender (if provided).
 */
function broadcast(retroId, payload) {
  const room = rooms.get(retroId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(data);
    }
  }
}

setBroadcast(broadcast);

server.listen(PORT, () => {
  console.log(`🚀 Sprint Retro server running on http://localhost:${PORT}`);
});
