import { useEffect } from 'preact/hooks';
import { html } from './ui/html.js';
import { useHash, navigate } from './ui/router.js';
import { ConfirmHost } from './ui/Dialog.js';
import { api } from './api.js';
import { LandingView } from './views/LandingView.js';
import { LoginView } from './views/LoginView.js';
import { DashboardView } from './views/DashboardView.js';
import { TemplatesView } from './views/TemplatesView.js';
import { UsersView } from './views/UsersView.js';
import { AccountView } from './views/AccountView.js';
import { RetroView } from './views/retro/RetroView.js';

/**
 * Hash router:
 * #/           → Public landing page (signed-in visitors go to #/app)
 * #/login      → Sign in (#/register opens it in register mode)
 * #/app        → My retros (sign-in required)
 * #/templates  → Retro templates (admin)
 * #/users      → User management (admin)
 * #/account    → Account and settings (sign-in required)
 * #/retro/:id  → Retro board (public — anyone with the link)
 */
function resolve(hash, user) {
  const retroMatch = hash.match(/^#\/retro\/([^/?]+)/);
  if (retroMatch) return { view: 'retro', retroId: decodeURIComponent(retroMatch[1]) };

  // An account still on a default password stays on the login page (which
  // shows the forced password-change prompt) until it's changed — the
  // server refuses its other requests anyway.
  const mustChange = !!user?.must_change_password;

  switch (hash) {
    case '#/login': return { view: 'login' };
    case '#/register': return { view: 'register' };
    case '#/app': return !user || mustChange ? { redirect: '#/login' } : { view: 'dashboard' };
    case '#/account': return !user || mustChange ? { redirect: '#/login' } : { view: 'account' };
    case '#/templates':
    case '#/users':
      if (!user || mustChange) return { redirect: '#/login' };
      if (user.role !== 'admin') return { redirect: '#/app' };
      return { view: hash.slice(2) };
    default:
      return user && !mustChange ? { redirect: '#/app' } : { view: 'landing' };
  }
}

export function App() {
  const hash = useHash();
  const user = api.getUser();
  const route = resolve(hash, user);

  useEffect(() => {
    if (route.redirect) navigate(route.redirect, { replace: true });
  }, [route.redirect]);

  // New page, start at the top
  useEffect(() => { window.scrollTo(0, 0); }, [hash]);

  let view = null;
  switch (route.view) {
    case 'landing': view = html`<${LandingView} />`; break;
    case 'login': view = html`<${LoginView} key="login" />`; break;
    case 'register': view = html`<${LoginView} key="register" startInRegister />`; break;
    case 'dashboard': view = html`<${DashboardView} />`; break;
    case 'templates': view = html`<${TemplatesView} />`; break;
    case 'users': view = html`<${UsersView} />`; break;
    case 'account': view = html`<${AccountView} />`; break;
    case 'retro': view = html`<${RetroView} key=${route.retroId} retroId=${route.retroId} />`; break;
  }

  return html`${view}<${ConfirmHost} />`;
}
