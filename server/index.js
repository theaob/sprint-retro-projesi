import http from 'http';
import app from './app.js';
import { setBroadcast } from './routes.js';
import { attachRealtime } from './realtime.js';

const PORT = process.env.PORT || 3000;

// ── HTTP + WebSocket Server ─────────────────────────────────
const server = http.createServer(app);
const { broadcast } = attachRealtime(server);

setBroadcast(broadcast);

server.listen(PORT, () => {
  console.log(`🚀 Retro Runway server running on http://localhost:${PORT}`);
});
