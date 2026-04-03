import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import routes, { setBroadcast } from './routes.js';
import { loadUser } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(loadUser);

// ── API routes ──────────────────────────────────────────────
app.use('/api', routes);

// ── Serve static files in production ───────────────────────
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── HTTP + WebSocket Server ─────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// rooms: Map<retroId, Set<WebSocket>>
const rooms = new Map();

wss.on('connection', (ws) => {
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
