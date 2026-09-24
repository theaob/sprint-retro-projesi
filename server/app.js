import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import { loadUser } from './auth.js';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// X-Forwarded-For is only trusted when TRUST_PROXY says a reverse proxy
// sits in front (e.g. TRUST_PROXY=1 for one hop), so express-rate-limit keys
// on the real client IP. Trusting it unconditionally let a directly exposed
// server (like the README's `docker run -p 3000:3000`) take the client IP
// from a header the client controls, and walk past the login rate limit.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

/** Maps the TRUST_PROXY env var onto Express's `trust proxy` setting. */
function parseTrustProxy(value) {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  const hops = Number(value);
  // A hop count, or anything else Express accepts (e.g. 'loopback', a subnet)
  return Number.isInteger(hops) ? hops : value;
}

// ── Middleware ──────────────────────────────────────────────
// CSP and COEP are off for now: the UI relies on inline `style="..."`
// attributes throughout and cross-origin Google Fonts, and a correct policy
// for those needs its own dedicated pass with full visual verification
// rather than a default that silently breaks styling. The other protections
// (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, etc.)
// are still on.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
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
      <html lang="en">
        <head><title>Retro not found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #020617; color: #f8fafc;">
          <h1>Retro not found</h1>
          <p>The link may be wrong, or the retro may have been deleted.</p>
          <a href="/" style="color: #4f46e5; text-decoration: none; font-weight: bold;">Go to the home page</a>
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

// ── Error handler ───────────────────────────────────────────
// JSON errors instead of Express's default HTML page, which includes a
// stack trace whenever NODE_ENV isn't 'production'.
app.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  // Thrown by express.json(): malformed JSON, or a body over its size limit
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

export default app;
