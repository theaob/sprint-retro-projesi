import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import { loadUser } from './auth.js';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

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

export default app;
