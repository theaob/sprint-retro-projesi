import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import routes, { setBroadcast } from './routes.js';
import { loadUser } from './auth.js';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(loadUser);

// ── API routes ──────────────────────────────────────────────
app.use('/api', routes);

// ── Short URL redirect ──────────────────────────────────────
app.get('/s/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  const retro = db.prepare('SELECT id FROM retros WHERE short_code = ?').get(shortCode);
  if (!retro) {
    return res.status(404).send(`
      <html>
        <head><title>Retro Bulunamadı</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #020617; color: #f8fafc;">
          <h1>😕 Retro Bulunamadı</h1>
          <p>Aradığınız retro bulunamadı veya silinmiş olabilir.</p>
          <a href="/" style="color: #4f46e5; text-decoration: none; font-weight: bold;">Ana Sayfaya Git</a>
        </body>
      </html>
    `);
  }
  res.redirect(`/#/retro/${retro.id}`);
});

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
    if (ws.isAlive === false) return ws.terminate();
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
