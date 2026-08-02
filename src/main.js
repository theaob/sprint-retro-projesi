import './style.css';
import { renderAdmin } from './views/admin.js';
import { renderRetro } from './views/retro/index.js';
import { renderLogin } from './views/login.js';
import { renderUsers } from './views/users.js';
import { renderOpenActions } from './views/openActions.js';
import { api } from './api.js';
import { applyTheme } from './utils.js';

applyTheme();

const app = document.getElementById('app');

/**
 * Hash-based router:
 * #/           → Admin panel  (requires admin)
 * #/login      → Login page
 * #/users      → User management (requires admin)
 * #/actions    → Open action items across retros (requires login)
 * #/retro/:id  → Retro board (public)
 */
function router() {
  const hash = window.location.hash || '#/';
  const retroMatch = hash.match(/^#\/retro\/(.+)$/);
  const usersMatch = hash === '#/users';
  const actionsMatch = hash === '#/actions';
  const loginMatch = hash === '#/login';

  if (retroMatch) {
    renderRetro(app, retroMatch[1]);
  } else if (loginMatch) {
    renderLogin(app);
  } else if (usersMatch) {
    if (!api.isAdmin()) {
      window.location.hash = '#/login';
      return;
    }
    renderUsers(app);
  } else if (actionsMatch) {
    if (!api.getUser()) {
      window.location.hash = '#/login';
      return;
    }
    renderOpenActions(app);
  } else {
    // Admin panel — requires login
    if (!api.getUser()) {
      window.location.hash = '#/login';
      return;
    }
    renderAdmin(app);
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

