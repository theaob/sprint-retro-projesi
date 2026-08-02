import './style.css';
import { renderAdmin } from './views/admin.js';
import { renderRetro } from './views/retro/index.js';
import { renderLogin } from './views/login.js';
import { renderUsers } from './views/users.js';
import { renderLanding } from './views/landing.js';
import { api } from './api.js';
import { applyTheme } from './utils.js';

applyTheme();

const app = document.getElementById('app');

/**
 * Hash-based router:
 * #/           → Public landing page (logged-in visitors bounce to #/app)
 * #/app        → Retro management dashboard (requires login)
 * #/login      → Login page
 * #/register   → Same login page, opened straight into register mode
 * #/users      → User management (requires admin)
 * #/retro/:id  → Retro board (public)
 */
function router() {
  const hash = window.location.hash || '#/';
  const retroMatch = hash.match(/^#\/retro\/(.+)$/);

  if (retroMatch) {
    renderRetro(app, retroMatch[1]);
  } else if (hash === '#/login') {
    renderLogin(app);
  } else if (hash === '#/register') {
    renderLogin(app, { startInRegister: true });
  } else if (hash === '#/users') {
    if (!api.isAdmin()) {
      window.location.hash = '#/login';
      return;
    }
    renderUsers(app);
  } else if (hash === '#/app') {
    if (!api.getUser()) {
      window.location.hash = '#/login';
      return;
    }
    renderAdmin(app);
  } else {
    // '#/' and any unrecognized hash both fall back here — an
    // already-authenticated visitor is bounced straight to the dashboard
    // so they never see marketing copy right after logging in.
    if (api.getUser()) {
      window.location.hash = '#/app';
      return;
    }
    renderLanding(app);
  }
}

// No DOMContentLoaded listener needed: module scripts are deferred by spec —
// they run after the document is fully parsed, before DOMContentLoaded fires
// — so this synchronous call already has a ready DOM. Registering both used
// to double-invoke router() on every initial load (harmless for the old
// innerHTML-based views' "last write wins" rendering, but it corrupts
// Preact's mount bookkeeping when two renders race on the same container).
window.addEventListener('hashchange', router);
router();

