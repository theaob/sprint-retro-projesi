import './style.css';
import { renderAdmin } from './views/admin.js';
import { renderRetro } from './views/retro.js';
import { renderLogin } from './views/login.js';
import { renderUsers } from './views/users.js';
import { api } from './api.js';

const app = document.getElementById('app');

/**
 * Hash-based router:
 * #/           → Admin panel  (requires admin)
 * #/login      → Login page
 * #/users      → User management (requires admin)
 * #/retro/:id  → Retro board (public)
 */
function router() {
  const hash = window.location.hash || '#/';
  const retroMatch = hash.match(/^#\/retro\/(.+)$/);
  const usersMatch = hash === '#/users';
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
  } else {
    // Admin panel — requires login
    if (!api.getUser()) {
      window.location.hash = '#/login';
      return;
    }
    renderAdmin(app);
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
router();
